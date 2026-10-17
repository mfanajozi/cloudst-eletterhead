"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, Image as ImageIcon, Users, Activity, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Assets", href: "/dashboard/assets", icon: ImageIcon },
  { name: "Builds", href: "/dashboard/builds", icon: Activity },
  { name: "Clients", href: "/dashboard/clients", icon: Users },
  { name: "Profile", href: "/dashboard/profile", icon: Settings },
];

export default function DashboardShell({
  userEmail,
  children,
}: {
  userEmail: string | undefined;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  const title = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-charcoal-900 text-white">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-charcoal-200 bg-charcoal-800 md:flex">
        <div className="flex h-16 items-center border-b border-charcoal-200 px-6">
          <Image
            src="/cloudst-favicon.png"
            alt="CloudST"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="ml-3 text-lg font-semibold tracking-tight text-gold-200">
            CloudST
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gold-200/10 text-gold-200"
                    : "text-charcoal-100 hover:bg-charcoal-200 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-charcoal-200 p-4">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-100 transition-colors hover:bg-charcoal-200 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen w-full flex-col md:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-charcoal-200 bg-charcoal-900/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Image
              src="/cloudst-favicon.png"
              alt="CloudST"
              width={28}
              height={28}
              className="rounded-full"
            />
            <span className="text-base font-semibold text-gold-200">CloudST</span>
          </div>
          <h1 className="hidden text-lg font-semibold text-white md:block">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[200px] truncate text-sm text-charcoal-100 sm:block">
              {userEmail}
            </span>
            <Link
              href="/dashboard/profile"
              aria-label="Profile settings"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-200 bg-charcoal-800 transition-colors hover:border-gold-200/50"
            >
              <Settings className="h-4 w-4 text-gold-200" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-charcoal-200 bg-charcoal-800/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="flex justify-around px-2 py-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-w-[60px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  isActive ? "text-gold-200" : "text-charcoal-100 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/assets": "Asset Upload",
    "/dashboard/builds": "Builds",
    "/dashboard/clients": "Clients",
    "/dashboard/profile": "Profile",
  };
  return titles[pathname] ?? "Dashboard";
}
