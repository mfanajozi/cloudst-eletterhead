import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * PUT /api/builds/artifact?<params>   (raw binary body)
 *
 * Called by the CI compiler (build-engine) after a successful cross-compilation.
 * Stores the artifact on the dashboard server's disk under ARTIFACT_DIR and
 * returns the download_url that the engine writes to `app_builds`.
 *
 * Auth: shared-secret header `x-artifact-key` matching ARTIFACT_INGEST_KEY —
 * the caller is the GitHub Actions runner, not a browser session.
 *
 * Params (query):
 *   build_id     app_builds id (uuid)      — also used as the folder name
 *   client_id    clients id (uuid)         — also used in the folder path
 *   platform     android|ios|windows|web
 *   version_code / build_number           — echoed back for traceability
 *   filename     final display file name, e.g. "android-v1.0.0.apk"
 */

const PLATFORMS = new Set(["android", "ios", "windows", "web"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Respect a sane ceiling; Supabase-side cap is no longer relevant but huge
// uploads in one request body should still be blocked deliberately, not accidentally.
const MAX_BYTES = Number(process.env.ARTIFACT_MAX_BYTES || 524_288_000); // 500 MB

function sanitizeFileName(name: string): string {
  return name.replace(/\\/g, "_").replace(/\.\./g, "_").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function artifactRoot(): string {
  return (
    process.env.ARTIFACT_DIR ||
    path.resolve(process.cwd(), "build-artifacts")
  );
}

function respondBad(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

export async function PUT(req: Request) {
  const ingestKey = process.env.ARTIFACT_INGEST_KEY;
  if (!ingestKey) {
    return respondBad(
      "Artifact storage not configured. Set ARTIFACT_INGEST_KEY (and optionally ARTIFACT_DIR) in the deployment environment.",
      503
    );
  }
  if ((req.headers.get("x-artifact-key") || "") !== ingestKey) {
    return respondBad("Invalid artifact ingest key.", 401);
  }

  const url = new URL(req.url);
  const buildId = url.searchParams.get("build_id") || "";
  const clientId = url.searchParams.get("client_id") || "";
  const platform = url.searchParams.get("platform") || "";
  const fileName = sanitizeFileName(url.searchParams.get("filename") || "artifact.bin");

  if (!UUID_RE.test(buildId)) return respondBad("Valid build_id (uuid) required.", 400);
  if (!UUID_RE.test(clientId)) return respondBad("Valid client_id (uuid) required.", 400);
  if (!PLATFORMS.has(platform)) return respondBad("platform must be android|ios|windows|web.", 400);

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return respondBad("Artifact exceeds ARTIFACT_MAX_BYTES.", 413);

  const clientDir = path.join(artifactRoot(), buildId);  await fs.promises.mkdir(clientDir, { recursive: true });
  const dest = path.join(clientDir, fileName);

  // Stream to disk with a hard byte ceiling (don't trust content-length alone).
  try {
    await streamToFile(req, dest, MAX_BYTES);
  } catch (err) {
    await fs.promises.rm(dest, { force: true });
    const message = err instanceof Error ? err.message : "stream failed";
    return respondBad(`Could not persist artifact: ${message}`, 400);
  }

  // Absolute public URL for the stored file (accepts an explicit override for
  // reverse-proxied deployments).
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const downloadUrl = `${origin}/api/builds/download/${buildId}/${encodeURIComponent(fileName)}`;

  return NextResponse.json({ ok: true, build_id: buildId, download_url: downloadUrl });
}

/** Streams the request body to `dest`, enforcing a max-size ceiling byte-by-byte. */
async function streamToFile(req: Request, dest: string, maxBytes: number) {
  if (!req.body) throw new Error("empty request body");
  const { Readable } = await import("node:stream");
  const nodeStream = Readable.fromWeb(req.body as unknown as import("node:stream/web").ReadableStream);
  const handle = await fs.promises.open(dest, "w");
  let written = 0;
  try {
    for await (const chunk of nodeStream) {
      const buf = chunk as Buffer;
      written += buf.length;
      if (written > maxBytes) throw new Error(`larger than ${maxBytes} bytes`);
      await handle.write(buf);
    }
  } finally {
    await handle.close();
  }
  if (written === 0) throw new Error("empty artifact");
}
