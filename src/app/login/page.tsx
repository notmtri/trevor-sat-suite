"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/field";
import {
  createSupabaseBrowserClient,
  isDemoMode,
} from "@/lib/supabase/client";
import { studentUsernameToEmail } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isDemoMode()) {
        router.push(role === "tutor" ? "/tutor" : "/student");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const email =
        role === "student"
          ? studentUsernameToEmail(identifier)
          : identifier.trim().toLowerCase();
      const { data, error: signInError } =
        await supabase!.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const actualRole = data.user.app_metadata.role;
      if (actualRole !== role) {
        await supabase!.auth.signOut();
        throw new Error(`This account is not a ${role} account.`);
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next ?? (role === "tutor" ? "/tutor" : "/student"));
      router.refresh();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--wash)] p-5">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-[var(--navy)] px-7 py-7 text-white">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 font-black">
            TS
          </div>
          <h1 className="mt-5 text-2xl font-black">
            Sign in to Trevor&apos;s SAT Suite
          </h1>
          <p className="mt-2 text-sm text-blue-100">
            Private practice for Trevor&apos;s students.
          </p>
        </div>
        <form className="p-7" onSubmit={signIn}>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {[
              ["student", UserRound, "Student"],
              ["tutor", GraduationCap, "Tutor"],
            ].map(([value, Icon, label]) => {
              const RoleIcon = Icon as typeof UserRound;
              return (
                <button
                  key={value as string}
                  type="button"
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition",
                    role === value
                      ? "bg-white text-[var(--navy)] shadow-sm"
                      : "text-slate-500",
                  )}
                  onClick={() => setRole(value as "student" | "tutor")}
                >
                  <RoleIcon className="h-4 w-4" /> {label as string}
                </button>
              );
            })}
          </div>
          <div className="mt-5">
            <FieldLabel>
              {role === "student" ? "Username" : "Email address"}
            </FieldLabel>
            <Input
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={role === "student" ? "first.last" : "you@example.com"}
              required
            />
          </div>
          <div className="mt-4">
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required={!isDemoMode()}
              placeholder="Your password"
            />
          </div>
          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          <Button
            className="mt-6 w-full"
            size="lg"
            loading={loading}
            icon={<LockKeyhole className="h-4 w-4" />}
          >
            Sign in
          </Button>
          {isDemoMode() && (
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              Demo mode is active. Choose a role and sign in without credentials.
            </p>
          )}
        </form>
      </Card>
    </main>
  );
}
