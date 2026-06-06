"use client";

import { createBrowserClient } from "@supabase/ssr";
export { isDemoMode, isSupabaseConfigured } from "@/lib/runtime-config";
import { isSupabaseConfigured } from "@/lib/runtime-config";

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
