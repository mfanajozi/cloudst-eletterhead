"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, Loader2 } from "lucide-react";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Build = Database["public"]["Tables"]["app_builds"]["Row"];

export default function ClientsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [clientsRes, buildsRes] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("app_builds").select("*"),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (buildsRes.data) setBuilds(buildsRes.data);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const buildCount = (clientId: string) =>
    builds.filter((b) => b.client_id === clientId).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="mt-1 text-sm text-charcoal-100">
            Manage your white-label client tenants and app configurations.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-gold-200" aria-hidden="true" />
            Client Directory
          </CardTitle>
          <Button
            variant="gold"
            size="sm"
            onClick={() => (window.location.href = "/dashboard/assets")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-charcoal-100">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading clients…
            </div>
          ) : clients.length === 0 ? (
            <p className="py-10 text-center text-sm text-charcoal-100">
              No clients yet.{" "}
              <Link href="/dashboard/assets" className="text-gold-200 underline-offset-4 hover:underline">
                Upload assets
              </Link>{" "}
              to create your first client.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-charcoal-200/50">
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100">Client</th>
                    <th className="hidden pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100 sm:table-cell">Package ID</th>
                    <th className="hidden pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100 md:table-cell">Assets</th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-charcoal-100">Builds</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-charcoal-200/30 last:border-0">
                      <td className="py-4 font-medium text-white">{c.company_name}</td>
                      <td className="hidden py-4 text-xs text-charcoal-100 sm:table-cell">{c.package_identity}</td>
                      <td className="hidden py-4 md:table-cell">
                        <div className="flex gap-1.5">
                          <Badge variant={c.letterhead_pdf_url ? "success" : "secondary"}>
                            PDF
                          </Badge>
                          <Badge variant={c.app_icon_url ? "success" : "secondary"}>
                            Icon
                          </Badge>
                          <Badge variant={c.splash_screen_url ? "success" : "secondary"}>
                            Splash
                          </Badge>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-charcoal-100">{buildCount(c.id)}</span>
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
