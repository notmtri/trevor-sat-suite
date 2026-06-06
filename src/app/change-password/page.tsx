"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
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
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/student");
        return;
      }
      const { data } = await supabase.auth.getUser();
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: {
          ...data.user?.user_metadata,
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
        .eq("id", data.user?.id);
      if (profileError) throw profileError;
      router.replace("/student");
      router.refresh();
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
        <h1 className="mt-5 text-2xl font-black">Choose a private password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your temporary password cannot be used again after this change.
        </p>
        <form className="mt-6" onSubmit={updatePassword}>
          <FieldLabel>New password</FieldLabel>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <div className="mt-4">
            <FieldLabel>Confirm password</FieldLabel>
            <Input
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
      </Card>
    </main>
  );
}
