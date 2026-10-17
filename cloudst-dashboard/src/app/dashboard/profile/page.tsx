"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ImagePlus, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data as Profile);
        setFullName(data.full_name ?? "");
        setAvatarPreview(data.avatar_url);
      }
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const handleAvatarSelect = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice({ type: "error", message: "Avatar must be an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ type: "error", message: "Avatar must be under 2MB." });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setNotice(null);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setNotice(null);

    try {
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const path = `${profile.id}/avatar.png`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = `${pub.publicUrl}?v=${Date.now()}`; // bust cache after overwrite
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName, avatar_url: avatarUrl })
        .eq("id", profile.id);
      if (updateErr) throw new Error(updateErr.message);

      setProfile({ ...profile, full_name: fullName, avatar_url: avatarUrl });
      setAvatarFile(null);
      setNotice({ type: "success", message: "Profile saved successfully." });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (newPassword.length < 8) {
      setNotice({ type: "error", message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ type: "error", message: "New passwords do not match." });
      return;
    }

    setChangingPassword(true);
    setNotice(null);

    try {
      // Verify the current password first
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (verifyErr) throw new Error("Current password is incorrect.");

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) throw new Error(updateErr.message);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({ type: "success", message: "Password updated successfully." });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-charcoal-100">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-1 text-sm text-charcoal-100">
          Manage your dashboard identity — avatar, display name, and password.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "rounded-xl p-4 text-sm",
            notice.type === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Avatar card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avatar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div
              className={cn(
                "flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2",
                avatarFile ? "border-gold-200/70" : "border-charcoal-200"
              )}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Your avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-charcoal-100" aria-hidden="true" />
              )}
            </div>
            <Label
              htmlFor="avatar-input"
              className="flex cursor-pointer items-center gap-2 text-sm text-gold-200 hover:underline"
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {avatarFile ? "Change selected" : "Choose avatar"}
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleAvatarSelect(e.target.files?.[0] ?? null)}
              />
            </Label>
            <p className="text-center text-xs text-charcoal-100">
              Max 2MB — square images look best.
            </p>
          </CardContent>
        </Card>

        {/* Account details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={profile?.email ?? ""}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-charcoal-100">
                    Contact support to change your admin email.
                  </p>
                </div>
              </div>
              <Button type="submit" variant="gold" disabled={savingProfile}>
                {savingProfile ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password card */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <Button type="submit" variant="outline" disabled={changingPassword}>
                {changingPassword ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Updating…
                  </span>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
