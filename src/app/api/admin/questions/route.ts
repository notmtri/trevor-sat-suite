import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateQuestionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "published", "rejected"]).optional(),
  section: z.enum(["Math", "Reading and Writing"]).optional(),
  domain: z.string().min(1).max(160).optional(),
  skill: z.string().min(1).max(160).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role !== "tutor") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const parsed = updateQuestionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid question update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, ...changes } = parsed.data;
  const databaseChanges = {
    ...(changes.status ? { status: changes.status } : {}),
    ...(changes.section ? { section: changes.section } : {}),
    ...(changes.domain ? { domain: changes.domain } : {}),
    ...(changes.skill ? { skill: changes.skill } : {}),
    ...(changes.difficulty ? { difficulty: changes.difficulty } : {}),
  };
  const { data, error } = await supabase
    .from("questions")
    .update(databaseChanges)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
