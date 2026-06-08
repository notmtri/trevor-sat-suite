import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  id: z.string().uuid(),
  attemptId: z.string().uuid(),
  summary: z.object({
    tutorComment: z.string().max(2000).optional(),
    strengths: z.array(z.string().max(120)).max(10).optional(),
    nextSteps: z.array(z.string().max(120)).max(10).optional(),
  }),
  releasedAt: z.string().datetime(),
});

const attemptUpdateSchema = z
  .object({
    id: z.string().uuid(),
    released: z.boolean().optional(),
    status: z.enum(["not_started", "in_progress", "submitted", "expired"]).optional(),
    report: reportSchema.optional(),
  })
  .refine(
    (value) => value.released !== undefined || value.status || value.report,
    { message: "No attempt changes were provided." },
  );

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

  const parsed = attemptUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid attempt update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: attempt, error: lookupError } = await supabase
    .from("attempts")
    .select("id,assignment_id,assignments!inner(tutor_id)")
    .eq("id", parsed.data.id)
    .eq("assignments.tutor_id", user.id)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const attemptChanges: Record<string, unknown> = {};
  if (parsed.data.released !== undefined) {
    attemptChanges.released = parsed.data.released;
  }
  if (parsed.data.status) {
    attemptChanges.status = parsed.data.status;
    if (parsed.data.status === "not_started") {
      Object.assign(attemptChanges, {
        current_module_id: null,
        current_question_index: 0,
        answered_count: 0,
        server_deadline: null,
        started_at: null,
        submitted_at: null,
        raw_correct: null,
        raw_total: null,
        estimated_score: null,
        score_range: null,
        released: false,
      });
    }
  }
  if (Object.keys(attemptChanges).length) {
    const { error } = await supabase
      .from("attempts")
      .update(attemptChanges)
      .eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.report && parsed.data.released !== false) {
    const report = parsed.data.report;
    const { error } = await supabase.from("released_reports").upsert({
      id: report.id,
      attempt_id: parsed.data.id,
      released_by: user.id,
      summary: report.summary,
      released_at: report.releasedAt,
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (parsed.data.released === false) {
    const { error } = await supabase
      .from("released_reports")
      .delete()
      .eq("attempt_id", parsed.data.id)
      .eq("released_by", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
