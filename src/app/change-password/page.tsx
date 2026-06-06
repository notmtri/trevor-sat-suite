"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/field";
import {
  createSupabaseBrowserClient,
  isDemoMode,
} from "@/lib/supabase/client";
import {
  roleHome,
  safeInternalPath,
  type AppRole,
} from "@/lib/navigation";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const requestedDestination = safeInternalPath(
        new URLSearchParams(window.location.search).get("next"),
        "/student",
      );
      if (isDemoMode() || !supabase) {
        window.location.replace(requestedDestination);
        return;
      }
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        throw userError ?? new Error("Your session has expired.");
      }
      const role = data.user.app_metadata.role as AppRole | undefined;
      const destination = safeInternalPath(
        new URLSearchParams(window.location.search).get("next"),
        roleHome(role),
      );
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: {
          ...data.user.user_metadata,
          must_change_password: false,
        },
      });
      if (passwordError) throw passwordError;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
      if (profileError) {
        console.error("Password changed, but profile sync failed:", profileError);
      }
      window.location.replace(destination);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Password update failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--wash)] p-5">
      <Card className="w-full max-w-md p-7">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-[var(--navy)]">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black">Change your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use at least 10 characters. After the update, you will return to your
          workspace automatically.
        </p>
        <form className="mt-6" onSubmit={updatePassword}>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <div className="mt-4">
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </div>
          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          <Button className="mt-6 w-full" loading={loading}>
            Update password
          </Button>
        </form>
        <Link
          href="/"
          className="focus-ring mx-auto mt-5 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:text-[var(--navy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Landing page
        </Link>
      </Card>
    </main>
  );
}
