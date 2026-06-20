import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireStudentSession,
  sessionErrorResponse,
} from "@/lib/supabase/attempt-server";

const responseSchema = z.object({
  questionId: z.string().uuid(),
  value: z.string().max(80),
  flagged: z.boolean(),
  eliminatedChoices: z.array(z.enum(["A", "B", "C", "D"])).max(4),
  secondsSpent: z.number().int().min(0).max(1000000),
  changedCount: z.number().int().min(0).max(10000),
});

const syncSchema = z.object({
  attemptId: z.string().uuid(),
  moduleId: z.string().uuid(),
  currentQuestionIndex: z.number().int().min(0).max(200),
  answeredCount: z.number().int().min(0).max(200),
  online: z.boolean(),
  responses: z.array(responseSchema).max(100),
});

export async function POST(request: Request) {
  const session = await requireStudentSession();
  if (session.error) {
    const error = sessionErrorResponse(session.error);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sync payload." }, { status: 400 });
  }
  const { admin, user } = session;
  const now = new Date();
  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select("id,status,server_deadline,current_module_id,assignment_id,assignments!inner(test_id)")
    .eq("id", parsed.data.attemptId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }
  if (!attempt || attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt is not active." }, { status: 409 });
  }
  if (
    !attempt.server_deadline ||
    new Date(attempt.server_deadline).getTime() <= now.getTime()
  ) {
    await admin
      .from("attempts")
      .update({
        status: "expired",
        submitted_at: now.toISOString(),
        connection_status: "stale",
        expired_while_offline: !parsed.data.online,
      })
      .eq("id", attempt.id);
    return NextResponse.json(
      { error: "Attempt expired.", expired: true },
      { status: 409 },
    );
  }
  if (attempt.current_module_id !== parsed.data.moduleId) {
    return NextResponse.json({ error: "Module mismatch." }, { status: 409 });
  }
  const assignmentRelation = Array.isArray(attempt.assignments)
    ? attempt.assignments[0]
    : attempt.assignments;
  const assignmentTestId =
    typeof assignmentRelation?.test_id === "string"
      ? assignmentRelation.test_id
      : "";
  if (!assignmentTestId) {
    return NextResponse.json(
      { error: "Attempt assignment is unavailable." },
      { status: 409 },
    );
  }
  const { data: placements, error: placementsError } = await admin
    .from("module_questions")
    .select("question_id,question_order,test_modules!inner(test_id)")
    .eq("module_id", parsed.data.moduleId)
    .eq("test_modules.test_id", assignmentTestId);
  if (placementsError) {
    return NextResponse.json({ error: placementsError.message }, { status: 500 });
  }
  const allowedQuestionIds = new Set(
    (placements ?? []).map((placement) => placement.question_id),
  );
  const responseQuestionIds = parsed.data.responses.map(
    (response) => response.questionId,
  );
  if (
    !allowedQuestionIds.size ||
    new Set(responseQuestionIds).size !== responseQuestionIds.length ||
    parsed.data.currentQuestionIndex >= allowedQuestionIds.size ||
    parsed.data.answeredCount > allowedQuestionIds.size ||
    parsed.data.responses.some(
      (response) => !allowedQuestionIds.has(response.questionId),
    )
  ) {
    return NextResponse.json(
      { error: "Response payload contains questions outside this module." },
      { status: 400 },
    );
  }

  if (parsed.data.responses.length) {
    const { error: responseError } = await admin.from("responses").upsert(
      parsed.data.responses.map((response) => ({
        attempt_id: attempt.id,
        question_id: response.questionId,
        value: response.value,
        flagged: response.flagged,
        eliminated_choices: response.eliminatedChoices,
        seconds_spent: response.secondsSpent,
        changed_count: response.changedCount,
        updated_at: now.toISOString(),
      })),
    );
    if (responseError) {
      return NextResponse.json({ error: responseError.message }, { status: 500 });
    }
  }
  const { error: updateError } = await admin
    .from("attempts")
    .update({
      current_question_index: parsed.data.currentQuestionIndex,
      answered_count: parsed.data.answeredCount,
      connection_status: parsed.data.online ? "online" : "offline",
      last_heartbeat_at: now.toISOString(),
    })
    .eq("id", attempt.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    deadline: attempt.server_deadline,
    serverNow: now.toISOString(),
  });
}
