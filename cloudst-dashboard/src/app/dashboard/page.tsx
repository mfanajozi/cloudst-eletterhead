"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Upload, Users, RefreshCcw } from "lucide-react";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Build = Database["public"]["Tables"]["app_builds"]["Row"];

export default function DashboardHome() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [builds, setBuilds] = useState<(Build & { clients: { company_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [clientsRes, buildsRes] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("app_builds").select("*, clients!inner(company_name)").order("created_at", { ascending: false }).limit(6),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (buildsRes.data) setBuilds(buildsRes.data as any);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const queued = builds.filter((b) => b.status === "queued").length;
  const compiling = builds.filter((b) => b.status === "compiling").length;
  const completed = builds.filter((b) => b.status === "completed").length;

  const stats = [
    {
      title: "Total Clients",
      value: clients.length,
      icon: Users,
      color: "text-gold-200",
    },
    {
      title: "Active Builds",
      value: compiling + queued,
      icon: Activity,
      color: "text-emerald-400",
    },
    {
      title: "Queued",
      value: queued,
      icon: Clock,
      color: "text-amber-400",
    },
    {
      title: "Completed",
      value: completed,
      icon: RefreshCcw,
      color: "text-gold-200",
    },
  ];

  const activity = [
    ...clients.slice(0, 3).map((c) => ({
      id: `c-${c.id}`,
      action: "Client provisioned",
      target: c.company_name,
      time: c.created_at,
      status: "completed" as const,
    })),
    ...builds
      .filter((b) => b.clients)
      .slice(0, 4)
      .map((b) => ({
        id: `b-${b.id}`,
        action: `${b.target_platform} build ${b.status}`,
        target: `${b.clients.company_name} · v${b.version_code}`,
        time: b.created_at,
        status: b.status,
      })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-charcoal-100">{stat.title}</span>
              <stat.icon className={`h-5 w-5 ${stat.color}`} aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl font-bold text-white">
              {loading ? <span className="text-charcoal-200">···</span> : stat.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-charcoal-200/50">
              {loading ? (
                <p className="py-6 text-sm text-charcoal-100">Loading activity…</p>
              ) : activity.length === 0 ? (
                <p className="py-6 text-sm text-charcoal-100">
                  No activity yet. Upload your first client assets to get started.
                </p>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 py-3.5 first:pt-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-charcoal-200/40">
                      <Activity className="h-4 w-4 text-charcoal-100" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{item.action}</p>
                      <p className="truncate text-xs text-charcoal-100">{item.target}</p>
                    </div>
                    <Badge
                      variant={
                        item.status === "completed"
                          ? "success"
                          : item.status === "failed"
                            ? "destructive"
                            : item.status === "compiling"
                              ? "warning"
                              : "default"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/assets" className={""} style={{ display: "block" }}>
              <Button variant="gold" className="w-full justify-start gap-2">
                <Upload className="h-4 w-4" />
                Upload New Asset
              </Button>
            </Link>
            <Link href="/dashboard/builds" className={""} style={{ display: "block" }}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <RefreshCcw className="h-4 w-4" />
                Trigger Build
              </Button>
            </Link>
            <Link href="/dashboard/clients" className={""} style={{ display: "block" }}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                Manage Clients
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-2">
        <Image
          src="/cloudst-logo-trans.png"
          alt="CloudST — AI Automation & Agents for Real Estate"
          width={220}
          height={64}
          className="opacity-40"
        />
      </div>
    </div>
  );
}
