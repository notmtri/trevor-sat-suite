import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const assignmentSchema = z
  .object({
    id: z.string().uuid(),
    testId: z.string().uuid(),
    studentIds: z.array(z.string().uuid()).min(1).max(50),
    title: z.string().min(1).max(160),
    availableAt: z.string().datetime(),
    dueAt: z.string().datetime(),
    attemptLimit: z.number().int().min(1).max(20),
    feedbackPolicy: z.enum([
      "immediate",
      "after_submission",
      "tutor_release",
    ]),
    allowResume: z.boolean(),
    status: z.enum(["scheduled", "open", "closed"]),
  })
  .refine((value) => new Date(value.dueAt) > new Date(value.availableAt), {
    message: "Due date must be after the availability date.",
  });

export async function POST(request: Request) {
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
  const parsed = assignmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const assignment = parsed.data;
  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id")
    .eq("id", assignment.testId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (testError) {
    return NextResponse.json({ error: testError.message }, { status: 500 });
  }
  if (!test) {
    return NextResponse.json({ error: "Test not found." }, { status: 404 });
  }
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("user_id,time_multiplier")
    .eq("tutor_id", user.id)
    .eq("status", "active")
    .in("user_id", assignment.studentIds);
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }
  if ((students ?? []).length !== assignment.studentIds.length) {
    return NextResponse.json(
      { error: "One or more selected students are unavailable." },
      { status: 400 },
    );
  }

  const { error: assignmentError } = await supabase.from("assignments").insert({
    id: assignment.id,
    tutor_id: user.id,
    test_id: assignment.testId,
    title: assignment.title,
    available_at: assignment.availableAt,
    due_at: assignment.dueAt,
    attempt_limit: assignment.attemptLimit,
    feedback_policy: assignment.feedbackPolicy,
    allow_resume: assignment.allowResume,
    status: assignment.status,
  });
  if (assignmentError) {
    return NextResponse.json(
      { error: assignmentError.message },
      { status: 500 },
    );
  }
  const { error: recipientsError } = await supabase
    .from("assignment_students")
    .insert(
      (students ?? []).map((student) => ({
        assignment_id: assignment.id,
        student_id: student.user_id,
        time_multiplier: student.time_multiplier,
      })),
    );
  if (recipientsError) {
    await supabase.from("assignments").delete().eq("id", assignment.id);
    return NextResponse.json(
      { error: recipientsError.message },
      { status: 500 },
    );
  }
  const { error: publishError } = await supabase
    .from("tests")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", assignment.testId)
    .eq("owner_id", user.id);
  if (publishError) {
    return NextResponse.json({ error: publishError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
