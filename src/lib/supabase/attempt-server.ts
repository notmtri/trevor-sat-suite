import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireStudentSession() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return { error: "unconfigured" as const };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role !== "student") {
    return { error: "forbidden" as const };
  }
  return { admin, user };
}

export function sessionErrorResponse(error: "unconfigured" | "forbidden") {
  return error === "unconfigured"
    ? { message: "Supabase is not configured.", status: 503 }
    : { message: "Forbidden.", status: 403 };
}
