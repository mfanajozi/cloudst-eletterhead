"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Download, Loader2, X } from "lucide-react";

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
            <div className="overflow-x-auto">
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
                        <Badge
                          variant={
                            b.status === "completed"
                              ? "success"
                              : b.status === "compiling"
                                ? "warning"
                                : b.status === "failed"
                                  ? "destructive"
                                  : "default"
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-4">
                        {b.download_url ? (
                          <Button variant="outline" size="sm" className="text-xs">
                            <Download className="mr-1 h-3 w-3" />
                            Download
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
