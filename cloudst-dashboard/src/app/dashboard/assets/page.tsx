"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Image as ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadSlots = {
  pdf: File | null;
  icon: File | null;
  splash: File | null;
};

const PLATFORMS = ["android", "ios", "windows", "web"] as const;

export default function AssetUploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState("");
  const [slots, setSlots] = useState<UploadSlots>({ pdf: null, icon: null, splash: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const allFilled = Boolean(companyName && slots.pdf && slots.icon && slots.splash);

  const readFile = (slot: keyof UploadSlots) => (file: File | null) => {
    if (!file) return;
    if (slot === "pdf" && file.type !== "application/pdf") {
      setError("Letterhead blueprint must be a PDF file.");
      return;
    }
    if (slot !== "pdf" && !file.type.startsWith("image/png")) {
      setError("Icon and splash assets must be high-resolution PNG files.");
      return;
    }
    if (slot !== "pdf" && file.size > 5 * 1024 * 1024) {
      setError("PNG assets must be under 5MB.");
      return;
    }
    setError(null);
    setSlots((prev) => ({ ...prev, [slot]: file }));
  };

  const handleDrop =
    (slot: keyof UploadSlots) => (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      readFile(slot)(e.dataTransfer.files?.[0] ?? null);
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allFilled) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Provision the client row keyed to the authenticated admin
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated. Please sign in again.");

      const packageIdentity = `${companyName
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .replace(/\s+/g, "")}.eletterhead`;

      const { data: clientRow, error: insertError } = await supabase
        .from("clients")
        .insert({
          admin_id: user.id,
          company_name: companyName,
          package_identity: packageIdentity,
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      const clientId = clientRow.id;
      const base = `${clientId}`;

      // Upload the three asset slots to letterhead-assets/{client_id}/
      const uploads: Array<{
        path: string;
        file: File;
        column: "letterhead_pdf_url" | "app_icon_url" | "splash_screen_url";
      }> = [
        { path: `${base}/template_letterhead.pdf`, file: slots.pdf!, column: "letterhead_pdf_url" },
        { path: `${base}/icon_source.png`, file: slots.icon!, column: "app_icon_url" },
        { path: `${base}/splash_source.png`, file: slots.splash!, column: "splash_screen_url" },
      ];

      const urlUpdates: Database["public"]["Tables"]["clients"]["Update"] = {};
      for (const u of uploads) {
        const { error: upErr } = await supabase.storage
          .from("letterhead-assets")
          .upload(u.path, u.file, { upsert: false, contentType: u.file.type });
        if (upErr) throw new Error(`${upErr.message} (${u.path})`);
        const { data: pub } = supabase.storage
          .from("letterhead-assets")
          .getPublicUrl(u.path);
        urlUpdates[u.column] = pub.publicUrl;
      }

      const { error: urlErr } = await supabase
        .from("clients")
        .update(urlUpdates)
        .eq("id", clientId);
      if (urlErr) throw new Error(urlErr.message);

      // Queue initial builds for every platform target
      const { error: buildErr } = await supabase.from("app_builds").insert(
        PLATFORMS.map((target_platform) => ({
          client_id: clientId,
          target_platform,
          status: "queued" as const,
        }))
      );
      if (buildErr) throw new Error(buildErr.message);

      setSuccess(`Client "${companyName}" provisioned — 4 builds queued across Android, iOS, Windows & Web.`);
      setCompanyName("");
      setSlots({ pdf: null, icon: null, splash: null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Asset Upload</h1>
        <p className="mt-1 text-sm text-charcoal-100">
          Upload a client's stationery blueprint and app graphics. The compiler provisions
          standalone Android, iOS, Windows & Web apps.
        </p>
      </div>

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company / Client Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Wackywalls Real Estate"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <UploadSlot
                label="Letterhead Blueprint"
                hint="Vector PDF · A4/Letter"
                icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                accept=".pdf,application/pdf"
                file={slots.pdf}
                onFile={readFile("pdf")}
                onDrop={handleDrop("pdf")}
                disabled={submitting}
              />
              <UploadSlot
                label="Launcher Icon"
                hint="1024×1024 PNG"
                icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
                accept=".png,image/png"
                file={slots.icon}
                onFile={readFile("icon")}
                onDrop={handleDrop("icon")}
                disabled={submitting}
              />
              <UploadSlot
                label="Splash Screen"
                hint="Boot flash PNG"
                icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
                accept=".png,image/png"
                file={slots.splash}
                onFile={readFile("splash")}
                onDrop={handleDrop("splash")}
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              variant="gold"
              className="w-full py-3"
              disabled={!allFilled || submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Provisioning client & queuing builds…
                </span>
              ) : (
                "Create Client & Queue Builds"
              )}
            </Button>
            <p className="text-center text-xs text-charcoal-100">
              Provisions the client in Supabase, uploads assets to storage, and queues 4
              platform builds for the compilation engine.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadSlot({
  label,
  hint,
  icon,
  accept,
  file,
  onFile,
  onDrop,
  disabled,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  onDrop: (e: DragEvent<HTMLLabelElement>) => void;
  disabled: boolean;
}) {
  return (
    <label
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors",
        file
          ? "border-gold-200/70 bg-gold-200/5"
          : "border-charcoal-200/60 hover:border-charcoal-100/60",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-200/40 text-charcoal-100">
        {icon}
      </div>
      <span className="text-xs font-medium text-white">{label}</span>
      <span className="text-[10px] text-charcoal-100">{file ? file.name : hint}</span>
      {file && <span className="text-[10px] font-medium text-emerald-400">Ready</span>}
    </label>
  );
}
