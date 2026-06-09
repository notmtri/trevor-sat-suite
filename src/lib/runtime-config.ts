const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseBrowserKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseBrowserKey);
}

export function getSupabaseBrowserConfig() {
  return {
    url: supabaseUrl,
    key: supabaseBrowserKey,
  };
}

export function isDemoMode() {
  const explicit = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (explicit !== undefined) return explicit === "true";
  return process.env.NODE_ENV !== "production" && !isSupabaseConfigured();
}

export function getMissingProductionConfig() {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseBrowserKey) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.NEXT_PUBLIC_DESMOS_API_KEY) {
    missing.push("NEXT_PUBLIC_DESMOS_API_KEY");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    missing.push("NEXT_PUBLIC_APP_URL");
  }
  return missing;
}
