import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeSprAnswer } from "@/lib/scoring";
import {
  requireStudentSession,
  sessionErrorResponse,
} from "@/lib/supabase/attempt-server";

const checkSchema = z.object({
  assignmentId: z.string().uuid(),
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  value: z.string().max(80),
});

export async function POST(request: Request) {
  const session = await requireStudentSession();
  if (session.error) {
    const error = sessionErrorResponse(session.error);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const parsed = checkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid answer check." }, { status: 400 });
  }
  const { admin, user } = session;
  const { data: assignment, error: assignmentError } = await admin
    .from("assignments")
    .select("id,test_id,feedback_policy,status,available_at,due_at")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }
  const { data: recipient, error: recipientError } = await admin
    .from("assignment_students")
    .select("student_id,available_at,due_at,recipient_status")
    .eq("assignment_id", parsed.data.assignmentId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (recipientError) {
    return NextResponse.json({ error: recipientError.message }, { status: 500 });
  }
  const effectiveAvailableAt = recipient?.available_at ?? assignment?.available_at;
  const effectiveDueAt = recipient?.due_at ?? assignment?.due_at;
  if (
    !assignment ||
    !recipient ||
    recipient.recipient_status === "excused" ||
    assignment.feedback_policy !== "immediate" ||
    assignment.status !== "open" ||
    new Date() < new Date(effectiveAvailableAt ?? 0) ||
    new Date() > new Date(effectiveDueAt ?? 0)
  ) {
    return NextResponse.json({ error: "Answer check unavailable." }, { status: 403 });
  }
  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select("id,current_module_id")
    .eq("id", parsed.data.attemptId)
    .eq("assignment_id", assignment.id)
    .eq("student_id", user.id)
    .eq("status", "in_progress")
    .maybeSingle();
  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }
  if (!attempt) {
    return NextResponse.json({ error: "Answer check unavailable." }, { status: 403 });
  }
  const { data: placement } = await admin
    .from("module_questions")
    .select("question_id,test_modules!inner(test_id)")
    .eq("question_id", parsed.data.questionId)
    .eq("module_id", attempt.current_module_id)
    .eq("test_modules.test_id", assignment.test_id)
    .limit(1)
    .maybeSingle();
  if (!placement) {
    return NextResponse.json({ error: "Question not assigned." }, { status: 404 });
  }
  const { data: question } = await admin
    .from("questions")
    .select("current_version_id")
    .eq("id", parsed.data.questionId)
    .single();
  const { data: version } = await admin
    .from("question_versions")
    .select("response_type")
    .eq("id", question?.current_version_id)
    .single();
  const { data: answers, error: answerError } = await admin
    .from("accepted_answers")
    .select("value,normalized_value")
    .eq("question_version_id", question?.current_version_id);
  if (answerError || !version) {
    return NextResponse.json(
      { error: answerError?.message ?? "Answer key unavailable." },
      { status: 500 },
    );
  }
  const value = parsed.data.value.trim();
  const correct =
    version.response_type === "multiple_choice"
      ? (answers ?? []).some(
          (answer) => answer.value.toUpperCase() === value.toUpperCase(),
        )
      : (answers ?? []).some(
          (answer) => answer.normalized_value === normalizeSprAnswer(value),
        );
  return NextResponse.json({ correct });
}
