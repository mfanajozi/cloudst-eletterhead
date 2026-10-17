import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/builds/delete  { buildId }
 *
 * Removes a finished build row (completed/failed) and, best-effort, the
 * compiled artifact files the CI engine published into Storage under
 * app-artifacts/{client_id}/{platform}/. The signed-URL artifacts expire on
 * their own after 7 days regardless, so a storage failure here is not fatal.
 * Requires a signed-in dashboard user (admin-scoped RLS project).
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY configuration." },
      { status: 503 }
    );
  }
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // Load the row first — we need its client/platform to target the artifacts.
  const loadRes = await fetch(
    `${supaUrl}/rest/v1/app_builds?select=id,client_id,target_platform&id=eq.${buildId}`,
    { headers: { ...svcHeaders, "Content-Type": "application/json" } }
  );
  if (!loadRes.ok) {
    return NextResponse.json(
      { error: `Could not load build: HTTP ${loadRes.status}` },
      { status: 502 }
    );
  }
  const build = ((await loadRes.json()) as Array<{
    id: string;
    client_id: string;
    target_platform: string;
  }>)[0];
  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  // Best-effort artifact cleanup (bucket layout from the CI publish step).
  try {
    const listRes = await fetch(
      `${supaUrl}/storage/v1/object/list/app-artifacts`,
      {
        method: "POST",
        headers: { ...svcHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: `app-artifacts/${build.client_id}/${build.target_platform}/`,
          limit: 100,
          sortBy: { column: "name", order: "asc" },
        }),
      }
    );
    if (listRes.ok) {
      const objects = (await listRes.json()) as Array<{ name: string }>;
      for (const obj of objects) {
        if (!obj?.name) continue;
        await fetch(
          `${supaUrl}/storage/v1/object/app-artifacts/${encodeURI(obj.name)}`,
          { method: "DELETE", headers: svcHeaders }
        );
      }
    }
  } catch {
    // Storage wipe is opportunistic — never block the DB delete on it.
  }

  const delRes = await fetch(`${supaUrl}/rest/v1/app_builds?id=eq.${buildId}`, {
    method: "DELETE",
    headers: { ...svcHeaders, "Content-Type": "application/json" },
  });
  if (!delRes.ok) {
    return NextResponse.json(
      { error: `Could not delete build: HTTP ${delRes.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
