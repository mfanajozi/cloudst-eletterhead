"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Download, Loader2, Trash2, X } from "lucide-react";

type Build = {
  id: string;
  target_platform: "android" | "ios" | "windows" | "web";
  status: "queued" | "compiling" | "completed" | "failed";
  version_code: string;
  build_number: number;
  download_url: string | null;
  error_log: string | null;
  created_at: string;
  clients: { company_name: string } | null;
};

export default function BuildsPage() {
  const supabase = createClient();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("app_builds")
      .select("*, clients(company_name)")
      .order("created_at", { ascending: false });
    if (!error && data) setBuilds(data as unknown as Build[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [supabase]);

  const triggerBuild = async (buildId: string) => {
    setTriggering(buildId);
    setNotice(null);
    try {
      const res = await fetch("/api/builds/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setNotice(json.error || "Failed to dispatch build.");
      } else {
        setNotice("Dispatched to the GitHub Actions compiler — status updates automatically.");
        await load();
      }
    } catch {
      setNotice("Network error while dispatching build.");
    } finally {
      setTriggering(null);
    }
  };

  const deleteBuild = async (buildId: string) => {
    if (!window.confirm("Delete this build and its stored artifact? This cannot be undone.")) return;
    setDeleting(buildId);
    setNotice(null);
    try {
      const res = await fetch("/api/builds/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setNotice(json.error || "Failed to delete build.");
      } else {
        await load();
      }
    } catch {
      setNotice("Network error while deleting build.");
    } finally {
      setDeleting(null);
    }
  };

  // Finished rows (with a delivered or failed compile) can be cleaned up.
  const isDeletable = (b: Build) => b.status === "completed" || b.status === "failed";

  const statusVariant = (
    s: Build["status"]
  ): "success" | "warning" | "destructive" | "default" =>
    s === "completed" ? "success" : s === "compiling" ? "warning" : s === "failed" ? "destructive" : "default";

  const downloadBuild = async (build: Build) => {    if (!build.download_url) return;
    setDownloading(build.id);
    setNotice(null);
    try {
      const res = await fetch(build.download_url);
      if (!res.ok) {
        setNotice(
          res.status === 404
            ? "Artifact not found or expired — re-trigger the build and try again."
            : `Download failed (HTTP ${res.status}).`
        );
        return;
      }
      const blob = await res.blob();
      // Filename: Content-Disposition header, else the URL's last path
      // segment (e.g. "web-v1.0.0.zip" from Supabase Storage), else a
      // platform-appropriate default — never a wrong extension.
      const fallbackName = (() => {
        try {
          const last = new URL(build.download_url!).pathname.split("/").filter(Boolean).pop();
          if (last && /\.[a-z0-9]{2,6}$/i.test(last)) return last;
        } catch {
          /* malformed URL — fall through */
        }
        const ext = build.target_platform === "android" ? "apk" : "zip";
        return `${build.clients?.company_name ?? "build"}-${build.target_platform}-v${build.version_code}.${ext}`;
      })();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        fallbackName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fetch failed (e.g. the stored URL is cross-origin) — let the browser
      // navigate directly; the route's Content-Disposition forces the download.
      const a = document.createElement("a");
      a.href = build.download_url;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Builds</h1>
        <p className="mt-1 text-sm text-charcoal-100">
          Track cross-compilation status and download generated binaries.
        </p>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-gold-200/30 bg-gold-200/5 p-4 text-sm text-gold-200">
          <span>{notice}</span>
          <button aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-gold-200" aria-hidden="true" />
            Build Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-charcoal-100">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading builds…
            </div>
          ) : builds.length === 0 ? (
            <p className="py-10 text-center text-sm text-charcoal-100">
              No builds yet. Upload client assets and queue your first build.
            </p>
          ) : (
            <>
              {/* Desktop: full table (unchanged) */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-charcoal-200/50">
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100">Client</th>
                    <th className="hidden pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100 sm:table-cell">Platform</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100">Version</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100">Status</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map((b) => (
                    <tr key={b.id} className="border-b border-charcoal-200/30 last:border-0">
                      <td className="py-4 font-medium text-white">{b.clients?.company_name ?? "—"}</td>
                      <td className="hidden py-4 capitalize text-charcoal-100 sm:table-cell">{b.target_platform}</td>
                      <td className="py-4 text-charcoal-100">{b.version_code}#{b.build_number}</td>
                      <td className="py-4">
                        <Badge variant={statusVariant(b.status)}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-4">
                        {b.download_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={downloading === b.id}
                            onClick={() => void downloadBuild(b)}
                          >
                            {downloading === b.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <Download className="mr-1 h-3 w-3" aria-hidden="true" />
                            )}
                            {downloading === b.id ? "Preparing…" : "Download"}
                          </Button>
                        ) : b.status === "queued" || b.status === "failed" ? (
                          <Button
                            variant="gold"
                            size="sm"
                            className="text-xs"
                            disabled={triggering === b.id}
                            onClick={() => void triggerBuild(b.id)}
                          >
                            {triggering === b.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <Activity className="mr-1 h-3 w-3" aria-hidden="true" />
                            )}
                            {triggering === b.id ? "Dispatching…" : "Trigger"}
                          </Button>
                        ) : (
                          <span className="text-xs text-charcoal-100">—</span>
                        )}
                        {isDeletable(b) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 px-2 text-xs text-charcoal-100 hover:text-red-400"
                            disabled={deleting === b.id}
                            onClick={() => void deleteBuild(b.id)}
                            title="Delete build and artifact"
                          >
                            {deleting === b.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards — the table is too cramped at this width */}
            <div className="space-y-3 sm:hidden">
              {builds.map((b) => (
                <div key={b.id} className="rounded-xl border border-charcoal-200/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-medium text-white">
                      {b.clients?.company_name ?? "—"}
                    </h3>
                    <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-charcoal-100">
                    <span className="capitalize">{b.target_platform}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {b.version_code}#{b.build_number}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {b.download_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={downloading === b.id}
                        onClick={() => void downloadBuild(b)}
                      >
                        {downloading === b.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Download className="mr-1 h-3 w-3" aria-hidden="true" />
                        )}
                        {downloading === b.id ? "Preparing…" : "Download"}
                      </Button>
                    ) : b.status === "queued" || b.status === "failed" ? (
                      <Button
                        variant="gold"
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={triggering === b.id}
                        onClick={() => void triggerBuild(b.id)}
                      >
                        {triggering === b.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Activity className="mr-1 h-3 w-3" aria-hidden="true" />
                        )}
                        {triggering === b.id ? "Dispatching…" : "Trigger"}
                      </Button>
                    ) : null}
                    {isDeletable(b) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-xs text-charcoal-100 hover:text-red-400"
                        disabled={deleting === b.id}
                        onClick={() => void deleteBuild(b.id)}
                        title="Delete build and artifact"
                      >
                        {deleting === b.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
