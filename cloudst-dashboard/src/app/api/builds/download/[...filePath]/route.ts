import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * GET /api/builds/download/{build_id}/{filename}
 *
 * Streams a compiled artifact from the dashboard server's disk (the path the
 * upload endpoint reported). No auth: the URL is intentionally unguessable —
 * it embeds the build's uuid — mirroring the previous signed-URL behaviour of
 * Supabase Storage. Tighten here later if links must expire.
 */

const ARTIFACT_ROOT = process.env.ARTIFACT_DIR || path.resolve(process.cwd(), "build-artifacts");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".app": "application/zip",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filePath: string[] }> }
) {
  const { filePath } = await params;

  if (!filePath || filePath.length !== 2) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [buildId, rawFileName] = filePath;
  if (!UUID_RE.test(buildId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Same sanitisation as the upload endpoint — no traversal, no odd characters.
  const fileName = rawFileName.replace(/\\/g, "_").replace(/\.\./g, "_").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

  const file = path.join(ARTIFACT_ROOT, buildId, fileName);
  // Belt-and-braces: the resolved path must live under the artifact root.
  if (!path.resolve(file).startsWith(path.resolve(ARTIFACT_ROOT) + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let size: number;
  try {
    const st = await fs.promises.stat(file);
    if (!st.isFile()) throw new Error("not a file");
    size = st.size;
  } catch {
    return NextResponse.json({ error: "Artifact not found or expired." }, { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
