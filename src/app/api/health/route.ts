import { NextResponse } from "next/server";
import {
  getMissingProductionConfig,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const demo = isDemoMode();
  const missing = getMissingProductionConfig();
  const ready = demo || (isSupabaseConfigured() && missing.length === 0);

  return NextResponse.json(
    {
      status: ready ? "ok" : "not_ready",
      mode: demo ? "demo" : "production",
      version:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
        process.env.npm_package_version ??
        "development",
      checks: {
        supabase: isSupabaseConfigured(),
        requiredEnvironment: missing.length === 0,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
