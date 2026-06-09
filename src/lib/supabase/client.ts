"use client";

import { createBrowserClient } from "@supabase/ssr";
export { isDemoMode, isSupabaseConfigured } from "@/lib/runtime-config";
import {
  getSupabaseBrowserConfig,
  isSupabaseConfigured,
} from "@/lib/runtime-config";

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, key } = getSupabaseBrowserConfig();
  return createBrowserClient(url!, key!);
}
