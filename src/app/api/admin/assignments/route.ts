import { NextResponse } from "next/server";
import { z } from "zod";
import type { TestDefinition, TestModule, WorkType } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateTestForAssignment } from "@/lib/work-types";

export const dynamic = "force-dynamic";

type SupabaseServerClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

const recipientSchema = z.object({
  studentId: z.string().uuid(),
  availableAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  attemptLimit: z.number().int().min(1).max(20).optional(),
  status: z.enum(["assigned", "extended", "excused"]),
});

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
    recipients: z.array(recipientSchema).max(50).optional(),
  })
  .refine((value) => new Date(value.dueAt) > new Date(value.availableAt), {
    message: "Due date must be after the availability date.",
  });

const assignmentUpdateSchema = z
  .object({
    id: z.string().uuid(),
    restore: z.literal(true).optional(),
    title: z.string().min(1).max(160).optional(),
    availableAt: z.string().datetime().optional(),
    dueAt: z.string().datetime().optional(),
    attemptLimit: z.number().int().min(1).max(20).optional(),
    feedbackPolicy: z
      .enum(["immediate", "after_submission", "tutor_release"])
      .optional(),
    allowResume: z.boolean().optional(),
    status: z.enum(["scheduled", "open", "closed"]).optional(),
    recipients: z.array(recipientSchema).max(50).optional(),
  })
  .refine(
    (value) =>
      value.restore === true ||
      value.title !== undefined ||
      value.availableAt !== undefined ||
      value.dueAt !== undefined ||
      value.attemptLimit !== undefined ||
      value.feedbackPolicy !== undefined ||
      value.allowResume !== undefined ||
      value.status !== undefined ||
      value.recipients !== undefined,
    { message: "No assignment changes were provided." },
  )
  .refine(
    (value) =>
      !value.restore ||
      (value.title === undefined &&
        value.availableAt === undefined &&
        value.dueAt === undefined &&
        value.attemptLimit === undefined &&
        value.feedbackPolicy === undefined &&
        value.allowResume === undefined &&
        value.status === undefined &&
        value.recipients === undefined),
    { message: "Restore cannot be combined with other assignment changes." },
  );

const assignmentDeleteSchema = z.object({
  id: z.string().uuid(),
});

function archiveState(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    status: row.status,
    archivedAt:
      typeof row.archived_at === "string" ? row.archived_at : null,
    archivedBy:
      typeof row.archived_by === "string" ? row.archived_by : null,
    archivedPreviousStatus:
      typeof row.archived_previous_status === "string"
        ? row.archived_previous_status
        : null,
  };
}

function parseWorkType(value: unknown, mode: TestDefinition["mode"]): WorkType {
  return value === "custom" ||
    value === "full_length" ||
    value === "verbal_simulation" ||
    value === "math_simulation" ||
    value === "verbal_practice" ||
    value === "math_practice"
    ? value
    : mode === "exam"
      ? "full_length"
      : "custom";
}

async function loadOwnedTest(
  supabase: SupabaseServerClient,
  ownerId: string,
  testId: string,
) {
  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("*")
    .eq("id", testId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (testError) throw testError;
  if (!test) return null;

  const { data: modules, error: modulesError } = await supabase
    .from("test_modules")
    .select("*")
    .eq("test_id", testId)
    .order("module_order");
  if (modulesError) throw modulesError;

  const moduleIds = (modules ?? []).map((module) => module.id as string);
  const { data: placements, error: placementsError } = moduleIds.length
    ? await supabase
        .from("module_questions")
        .select("*")
        .in("module_id", moduleIds)
        .order("question_order")
    : { data: [], error: null };
  if (placementsError) throw placementsError;

  const testMode = test.mode as TestDefinition["mode"];
  const mappedModules: TestModule[] = (modules ?? []).map((module) => ({
    id: module.id as string,
    title: module.title as string,
    section: module.section as TestModule["section"],
    durationMinutes: Number(module.duration_minutes),
    route: module.route as TestModule["route"],
    order: Number(module.module_order),
    questions: (placements ?? [])
      .filter((placement) => placement.module_id === module.id)
      .map((placement) => ({
        questionId: placement.question_id as string,
        order: Number(placement.question_order),
        unscored: Boolean(placement.unscored),
      })),
  }));

  return {
    id: test.id as string,
    title: test.title as string,
    description: (test.description as string) ?? "",
    mode: testMode,
    workType: parseWorkType(test.work_type, testMode),
    status: test.status as TestDefinition["status"],
    routingThreshold: Number(test.routing_threshold ?? 0.6),
    createdAt: test.created_at as string,
    modules: mappedModules,
  } satisfies TestDefinition;
}

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
  let test: TestDefinition | null;
  try {
    test = await loadOwnedTest(supabase, user.id, assignment.testId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test lookup failed." },
      { status: 500 },
    );
  }
  if (!test) {
    return NextResponse.json({ error: "Test not found." }, { status: 404 });
  }
  const validation = validateTestForAssignment(test);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.join(" ") },
      { status: 400 },
    );
  }
  const questionIds = [
    ...new Set(
      test.modules.flatMap((testModule) =>
        testModule.questions.map((question) => question.questionId),
      ),
    ),
  ];
  if (questionIds.length) {
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id,status")
      .eq("owner_id", user.id)
      .in("id", questionIds);
    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 },
      );
    }
    if ((questions ?? []).length !== questionIds.length) {
      return NextResponse.json(
        { error: "One or more test questions are unavailable." },
        { status: 400 },
      );
    }
    if ((questions ?? []).some((question) => question.status !== "published")) {
      return NextResponse.json(
        { error: "Only tests with published questions can be assigned." },
        { status: 400 },
      );
    }
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
        available_at: assignment.recipients?.find(
          (recipient) => recipient.studentId === student.user_id,
        )?.availableAt,
        due_at: assignment.recipients?.find(
          (recipient) => recipient.studentId === student.user_id,
        )?.dueAt,
        attempt_limit: assignment.recipients?.find(
          (recipient) => recipient.studentId === student.user_id,
        )?.attemptLimit,
        recipient_status:
          assignment.recipients?.find(
            (recipient) => recipient.studentId === student.user_id,
          )?.status ?? "assigned",
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

  const parsed = assignmentUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("tutor_id", user.id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  if (parsed.data.restore) {
    const { error } = await supabase.rpc("restore_assignment", {
      target_assignment: parsed.data.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: restored, error: restoredError } = await supabase
      .from("assignments")
      .select("id,status,archived_at,archived_by,archived_previous_status")
      .eq("id", parsed.data.id)
      .eq("tutor_id", user.id)
      .single();
    if (restoredError) {
      return NextResponse.json({ error: restoredError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, assignment: archiveState(restored) });
  }

  if (existing.archived_at) {
    return NextResponse.json(
      { error: "Restore this assignment before editing it." },
      { status: 409 },
    );
  }

  const nextAvailableAt = parsed.data.availableAt ?? existing.available_at;
  const nextDueAt = parsed.data.dueAt ?? existing.due_at;
  if (new Date(nextDueAt) <= new Date(nextAvailableAt)) {
    return NextResponse.json(
      { error: "Due date must be after the availability date." },
      { status: 400 },
    );
  }

  const changes: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) changes.title = parsed.data.title;
  if (parsed.data.availableAt !== undefined) {
    changes.available_at = parsed.data.availableAt;
  }
  if (parsed.data.dueAt !== undefined) changes.due_at = parsed.data.dueAt;
  if (parsed.data.attemptLimit !== undefined) {
    changes.attempt_limit = parsed.data.attemptLimit;
  }
  if (parsed.data.feedbackPolicy !== undefined) {
    changes.feedback_policy = parsed.data.feedbackPolicy;
  }
  if (parsed.data.allowResume !== undefined) {
    changes.allow_resume = parsed.data.allowResume;
  }
  if (parsed.data.status !== undefined) changes.status = parsed.data.status;

  if (Object.keys(changes).length) {
    const { error } = await supabase
      .from("assignments")
      .update(changes)
      .eq("id", parsed.data.id)
      .eq("tutor_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.recipients) {
    const studentIds = parsed.data.recipients.map(
      (recipient) => recipient.studentId,
    );
    const { data: students, error } = await supabase
      .from("students")
      .select("user_id,time_multiplier")
      .eq("tutor_id", user.id)
      .in("user_id", studentIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((students ?? []).length !== studentIds.length) {
      return NextResponse.json(
        { error: "One or more selected students are unavailable." },
        { status: 400 },
      );
    }

    const studentMap = new Map(
      (students ?? []).map((student) => [student.user_id, student]),
    );
    const { error: deleteError } = await supabase
      .from("assignment_students")
      .delete()
      .eq("assignment_id", parsed.data.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    if (parsed.data.recipients.length) {
      const { error: insertError } = await supabase
        .from("assignment_students")
        .insert(
          parsed.data.recipients.map((recipient) => ({
            assignment_id: parsed.data.id,
            student_id: recipient.studentId,
            time_multiplier: studentMap.get(recipient.studentId)?.time_multiplier,
            available_at: recipient.availableAt,
            due_at: recipient.dueAt,
            attempt_limit: recipient.attemptLimit,
            recipient_status: recipient.status,
          })),
        );
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
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

  const parsed = assignmentDeleteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment deletion request." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("tutor_id", user.id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const { error } = await supabase.rpc("archive_assignment", {
    target_assignment: parsed.data.id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data: archived, error: archivedError } = await supabase
    .from("assignments")
    .select("id,status,archived_at,archived_by,archived_previous_status")
    .eq("id", parsed.data.id)
    .eq("tutor_id", user.id)
    .single();
  if (archivedError) {
    return NextResponse.json({ error: archivedError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, assignment: archiveState(archived) });
}
