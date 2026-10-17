import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/builds/trigger  { buildId }
 *
 * Fires a `repository_dispatch: build-client` event at GitHub Actions so the
 * compilation engine picks the client's assets and compiles a standalone app.
 * Requires (configured in the hosting environment):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GITHUB_DISPATCH_PAT     (fine-grained PAT with Contents: write → triggers)
 *   GITHUB_REPO             (defaults to mfanajozi/cloudst-eletterhead)
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let buildId: string | null | undefined = null;
  try {
    ({ buildId } = (await req.json()) as { buildId?: string });
  } catch {
    buildId = null;
  }
  if (!buildId) {
    return NextResponse.json({ error: "buildId is required" }, { status: 400 });
  }

  const supaUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");
  // Either secret name is accepted (canonical or the guide's SUPABASE_SECRET_KEY).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const pat = process.env.GITHUB_DISPATCH_PAT;
  const repo = process.env.GITHUB_REPO || "mfanajozi/cloudst-eletterhead";

  if (!supaUrl || !serviceKey || !pat) {
    return NextResponse.json(
      {
        error:
          "Compilation service not configured. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), SUPABASE_URL and GITHUB_DISPATCH_PAT in the deployment environment.",
      },
      { status: 503 }
    );
  }

  // Load the build + its client with service credentials (caller is authed).
  const res = await fetch(
    `${supaUrl}/rest/v1/app_builds?select=*,clients(id,company_name,package_identity)&id=eq.${buildId}`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    }
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: `Could not load build: HTTP ${res.status}` },
      { status: 502 }
    );
  }
  const rows = (await res.json()) as Array<{
    id: string;
    client_id: string;
    target_platform: string;
    version_code: string;
    build_number: number;
    status: string;
    clients: {
      id: string;
      company_name: string;
      package_identity: string;
    } | null;
  }>;
  const build = rows[0];
  if (!build || !build.clients) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }
  if (build.status === "compiling") {
    return NextResponse.json(
      { error: "This build is already compiling." },
      { status: 409 }
    );
  }

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${repo}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "build-client",
        client_payload: {
          platform: build.target_platform,
          client_id: build.client_id,
          build_id: build.id,
          app_name: build.clients.company_name,
          package_identity: build.clients.package_identity,
          version_code: build.version_code,
          build_number: String(build.build_number),
        },
      }),
    }
  );

  if (dispatchRes.status !== 204) {
    const detail = await dispatchRes.text();
    return NextResponse.json(
      { error: `GitHub dispatch failed (HTTP ${dispatchRes.status}): ${detail.slice(0, 200)}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, platform: build.target_platform });
}
