import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { isDemoMode, isSupabaseConfigured } from "@/lib/runtime-config";

export default function SetupRequiredPage() {
  const configured = isSupabaseConfigured();
  const demo = isDemoMode();

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--wash)] p-5">
      <Card className="w-full max-w-xl p-8">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black">Deployment setup required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This instance is not ready to accept tutor or student sign-ins. Add
          the required Supabase, Desmos, and application URL environment
          variables, then redeploy with demo mode disabled.
        </p>
        <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm">
          <p>
            Supabase: <strong>{configured ? "configured" : "missing"}</strong>
          </p>
          <p className="mt-1">
            Demo mode: <strong>{demo ? "enabled" : "disabled"}</strong>
          </p>
        </div>
        <Link
          href="/"
          className="focus-ring mt-6 inline-flex h-11 items-center rounded-xl bg-[var(--navy)] px-5 text-sm font-bold text-white"
        >
          Return home
        </Link>
      </Card>
    </main>
  );
}
