import { NextResponse } from "next/server";
import { z } from "zod";
import type { ScoreSectionSummary, ScoreSummary, Section } from "@/lib/domain";
import { normalizeSprAnswer } from "@/lib/scoring";
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

const submitSchema = z.object({
  attemptId: z.string().uuid(),
  expired: z.boolean(),
  online: z.boolean(),
  responses: z.array(responseSchema).max(200),
});

function estimateSectionScore(accuracy: number) {
  const midpoint = Math.round((200 + 600 * accuracy) / 10) * 10;
  const estimatedScore = Math.min(800, Math.max(200, midpoint));
  return {
    estimatedScore,
    estimatedScoreRange: [
      Math.max(200, estimatedScore - 30),
      Math.min(800, estimatedScore + 30),
    ] as [number, number],
  };
}

export async function POST(request: Request) {
  const session = await requireStudentSession();
  if (session.error) {
    const error = sessionErrorResponse(session.error);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  const { admin, user } = session;
  const now = new Date();
  const { data: attempt, error: attemptError } = await admin
    .from("attempts")
    .select("id,assignment_id,status,server_deadline")
    .eq("id", parsed.data.attemptId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }
  if (!attempt || attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt is not active." }, { status: 409 });
  }
  const { data: assignment, error: assignmentError } = await admin
    .from("assignments")
    .select("test_id,feedback_policy")
    .eq("id", attempt.assignment_id)
    .single();
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }
  const { data: modules, error: modulesError } = await admin
    .from("test_modules")
    .select("id,section")
    .eq("test_id", assignment.test_id);
  if (modulesError) {
    return NextResponse.json({ error: modulesError.message }, { status: 500 });
  }
  const moduleIds = (modules ?? []).map((testModule) => testModule.id);
  const { data: placements, error: placementsError } = moduleIds.length
    ? await admin
        .from("module_questions")
        .select("module_id,question_id,unscored")
        .in("module_id", moduleIds)
    : { data: [], error: null };
  if (placementsError) {
    return NextResponse.json({ error: placementsError.message }, { status: 500 });
  }
  const placementMap = new Map(
    (placements ?? []).map((placement) => [
      placement.question_id,
      placement.unscored,
    ]),
  );
  const moduleSectionMap = new Map(
    (modules ?? []).map((testModule) => [
      testModule.id,
      testModule.section as Section,
    ]),
  );
  const questionSectionMap = new Map(
    (placements ?? []).map((placement) => [
      placement.question_id,
      moduleSectionMap.get(placement.module_id) ?? "Math",
    ]),
  );
  const questionIds = [...placementMap.keys()];
  const { data: questions, error: questionsError } = questionIds.length
    ? await admin
        .from("questions")
        .select("id,current_version_id")
        .in("id", questionIds)
    : { data: [], error: null };
  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }
  const versionIds = (questions ?? []).map(
    (question) => question.current_version_id,
  );
  const [{ data: versions }, { data: answers }] = await Promise.all([
    versionIds.length
      ? admin
          .from("question_versions")
          .select("id,response_type")
          .in("id", versionIds)
      : Promise.resolve({ data: [] }),
    versionIds.length
      ? admin
          .from("accepted_answers")
          .select("question_version_id,value,normalized_value")
          .in("question_version_id", versionIds)
      : Promise.resolve({ data: [] }),
  ]);
  const questionVersionMap = new Map(
    (questions ?? []).map((question) => [
      question.id,
      question.current_version_id,
    ]),
  );
  const responseTypeMap = new Map(
    (versions ?? []).map((version) => [version.id, version.response_type]),
  );
  const responseMap = new Map(
    parsed.data.responses.map((response) => [
      response.questionId,
      response.value.trim(),
    ]),
  );
  let correct = 0;
  let total = 0;
  const sectionStats = new Map<
    Section,
    { rawCorrect: number; rawTotal: number }
  >();
  for (const questionId of questionIds) {
    if (placementMap.get(questionId)) continue;
    total += 1;
    const section = questionSectionMap.get(questionId) ?? "Math";
    const stats = sectionStats.get(section) ?? { rawCorrect: 0, rawTotal: 0 };
    stats.rawTotal += 1;
    const versionId = questionVersionMap.get(questionId);
    const responseType = responseTypeMap.get(versionId);
    const accepted = (answers ?? []).filter(
      (answer) => answer.question_version_id === versionId,
    );
    const value = responseMap.get(questionId) ?? "";
    const isCorrect =
      responseType === "multiple_choice"
        ? accepted.some(
            (answer) => answer.value.toUpperCase() === value.toUpperCase(),
          )
        : accepted.some(
            (answer) => answer.normalized_value === normalizeSprAnswer(value),
          );
    if (isCorrect) correct += 1;
    if (isCorrect) stats.rawCorrect += 1;
    sectionStats.set(section, stats);
  }

  const sections: ScoreSectionSummary[] = Array.from(sectionStats.entries()).map(
    ([section, stats]) => {
      const accuracy = stats.rawTotal ? stats.rawCorrect / stats.rawTotal : 0;
      return {
        section,
        rawCorrect: stats.rawCorrect,
        rawTotal: stats.rawTotal,
        accuracy,
        ...estimateSectionScore(accuracy),
      };
    },
  );
  const hasBothSections =
    sections.some((section) => section.section === "Reading and Writing") &&
    sections.some((section) => section.section === "Math");
  const scoreSummary: ScoreSummary = {
    rawCorrect: correct,
    rawTotal: total,
    accuracy: total ? correct / total : 0,
    estimatedScoreRange: hasBothSections
      ? [
          sections.reduce(
            (sum, section) => sum + section.estimatedScoreRange[0],
            0,
          ),
          sections.reduce(
            (sum, section) => sum + section.estimatedScoreRange[1],
            0,
          ),
        ]
      : sections[0]?.estimatedScoreRange,
    estimatedScore: hasBothSections
      ? sections.reduce((sum, section) => sum + section.estimatedScore, 0)
      : sections[0]?.estimatedScore,
    sections,
    label: "Unofficial tutor-estimated SAT range",
  };

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
  const expired =
    parsed.data.expired ||
    !attempt.server_deadline ||
    new Date(attempt.server_deadline).getTime() <= now.getTime();
  const released = assignment.feedback_policy !== "tutor_release";
  const { error: updateError } = await admin
    .from("attempts")
    .update({
      status: expired ? "expired" : "submitted",
      answered_count: parsed.data.responses.filter((response) =>
        response.value.trim(),
      ).length,
      connection_status: parsed.data.online ? "online" : "offline",
      submitted_at: now.toISOString(),
      last_heartbeat_at: now.toISOString(),
      raw_correct: correct,
      raw_total: total,
      score_summary: scoreSummary,
      expired_while_offline: expired && !parsed.data.online,
      released,
    })
    .eq("id", attempt.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({
    attemptId: attempt.id,
    status: expired ? "expired" : "submitted",
    submittedAt: now.toISOString(),
    released,
    ...(released ? { rawCorrect: correct, rawTotal: total, scoreSummary } : {}),
  });
}
