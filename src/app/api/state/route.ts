import { NextResponse } from "next/server";
import type {
  AppState,
  Assignment,
  AssignmentRecipient,
  Attempt,
  Question,
  ReleasedReport,
  ScoreSummary,
  Student,
  TestDefinition,
  WorkType,
} from "@/lib/domain";
import { normalizeQuestionContent } from "@/lib/question-content";
import { normalizeTutorSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseScoreRange(value: unknown): [number, number] | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^[[(](\d+),(\d+)[)\]]$/);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2])];
}

function parseScoreSummary(value: unknown): ScoreSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as ScoreSummary;
}

function parseWorkType(value: unknown, mode: TestDefinition["mode"]): WorkType {
  const workType = text(value);
  if (
    workType === "custom" ||
    workType === "full_length" ||
    workType === "verbal_simulation" ||
    workType === "math_simulation" ||
    workType === "verbal_practice" ||
    workType === "math_practice"
  ) {
    return workType;
  }
  return mode === "exam" ? "full_length" : "custom";
}

export async function GET() {
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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const role = user.app_metadata.role as "tutor" | "student" | undefined;
  if (!role) {
    return NextResponse.json({ error: "Account role is missing." }, { status: 403 });
  }

  const [
    profilesResult,
    studentsResult,
    questionsResult,
    testsResult,
    assignmentsResult,
    attemptsResult,
    settingsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("students").select("*"),
    supabase.from("questions").select("*").order("created_at", {
      ascending: false,
    }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("attempts")
      .select("*")
      .order("created_at", { ascending: false }),
    role === "tutor"
      ? supabase.from("tutor_settings").select("*").eq("tutor_id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const failed = [
    profilesResult,
    studentsResult,
    questionsResult,
    testsResult,
    assignmentsResult,
    attemptsResult,
    settingsResult,
  ].find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  const profileRows = rows(profilesResult.data);
  const studentRows = rows(studentsResult.data);
  const questionRows = rows(questionsResult.data);
  const testRows = rows(testsResult.data);
  const assignmentRows = rows(assignmentsResult.data);
  const attemptRows = rows(attemptsResult.data);
  const settingsRow = settingsResult.data as Row | null;

  if (
    role === "student" &&
    studentRows.some(
      (student) =>
        text(student.user_id) === user.id && text(student.status) === "disabled",
    )
  ) {
    return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
  }

  const versionIds = questionRows
    .map((question) => text(question.current_version_id))
    .filter(Boolean);
  const testIds = testRows.map((test) => text(test.id)).filter(Boolean);
  const assignmentIds = assignmentRows
    .map((assignment) => text(assignment.id))
    .filter(Boolean);
  const attemptIds = attemptRows.map((attempt) => text(attempt.id)).filter(Boolean);

  const [
    versionsResult,
    modulesResult,
    assignmentStudentsResult,
    responsesResult,
    releasedReportsResult,
  ] = await Promise.all([
    versionIds.length
      ? supabase.from("question_versions").select("*").in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    testIds.length
      ? supabase
          .from("test_modules")
          .select("*")
          .in("test_id", testIds)
          .order("module_order")
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabase
          .from("assignment_students")
          .select("*")
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
    attemptIds.length
      ? supabase.from("responses").select("*").in("attempt_id", attemptIds)
      : Promise.resolve({ data: [], error: null }),
    attemptIds.length
      ? supabase.from("released_reports").select("*").in("attempt_id", attemptIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const secondaryFailed = [
    versionsResult,
    modulesResult,
    assignmentStudentsResult,
    responsesResult,
    releasedReportsResult,
  ].find((result) => result.error);
  if (secondaryFailed?.error) {
    return NextResponse.json(
      { error: secondaryFailed.error.message },
      { status: 500 },
    );
  }

  const versionRows = rows(versionsResult.data);
  const moduleRows = rows(modulesResult.data);
  const moduleIds = moduleRows.map((module) => text(module.id)).filter(Boolean);
  const sourceDocumentIds = versionRows
    .map((version) => text(version.source_document_id))
    .filter(Boolean);

  const [
    assetsResult,
    answersResult,
    moduleQuestionsResult,
    sourceDocumentsResult,
  ] = await Promise.all([
    versionIds.length
      ? supabase
          .from("question_assets")
          .select("*")
          .in("question_version_id", versionIds)
          .order("asset_order")
      : Promise.resolve({ data: [], error: null }),
    role === "tutor" && versionIds.length
      ? supabase
          .from("accepted_answers")
          .select("*")
          .in("question_version_id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    moduleIds.length
      ? supabase
          .from("module_questions")
          .select("*")
          .in("module_id", moduleIds)
          .order("question_order")
      : Promise.resolve({ data: [], error: null }),
    role === "tutor" && sourceDocumentIds.length
      ? supabase
          .from("source_documents")
          .select("*")
          .in("id", sourceDocumentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const tertiaryFailed = [
    assetsResult,
    answersResult,
    moduleQuestionsResult,
    sourceDocumentsResult,
  ].find((result) => result.error);
  if (tertiaryFailed?.error) {
    return NextResponse.json(
      { error: tertiaryFailed.error.message },
      { status: 500 },
    );
  }

  const versionMap = new Map(
    versionRows.map((version) => [text(version.id), version]),
  );
  const sourceDocumentMap = new Map(
    rows(sourceDocumentsResult.data).map((document) => [
      text(document.id),
      document,
    ]),
  );
  const assetRows = rows(assetsResult.data);
  const moduleQuestionRows = rows(moduleQuestionsResult.data);
  let answerRows = rows(answersResult.data);
  if (role === "student") {
    const releasedAssignmentIds = new Set(
      attemptRows
        .filter(
          (attempt) =>
            Boolean(attempt.released) &&
            ["submitted", "expired"].includes(text(attempt.status)),
        )
        .map((attempt) => text(attempt.assignment_id)),
    );
    const releasedTestIds = new Set(
      assignmentRows
        .filter((assignment) => releasedAssignmentIds.has(text(assignment.id)))
        .map((assignment) => text(assignment.test_id)),
    );
    const releasedModuleIds = new Set(
      moduleRows
        .filter((module) => releasedTestIds.has(text(module.test_id)))
        .map((module) => text(module.id)),
    );
    const releasedQuestionIds = new Set(
      moduleQuestionRows
        .filter((moduleQuestion) =>
          releasedModuleIds.has(text(moduleQuestion.module_id)),
        )
        .map((moduleQuestion) => text(moduleQuestion.question_id)),
    );
    const releasedVersionIds = questionRows
      .filter((question) => releasedQuestionIds.has(text(question.id)))
      .map((question) => text(question.current_version_id))
      .filter(Boolean);
    const admin = createSupabaseAdminClient();
    if (admin && releasedVersionIds.length) {
      const { data, error } = await admin
        .from("accepted_answers")
        .select("*")
        .in("question_version_id", releasedVersionIds);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      answerRows = rows(data);
    }
  }

  const questions: Question[] = questionRows.flatMap((question) => {
    const version = versionMap.get(text(question.current_version_id));
    if (!version) return [];
    const versionId = text(version.id);
    const sourceDocument = sourceDocumentMap.get(
      text(version.source_document_id),
    );
    const mappedAssets = assetRows
      .filter((asset) => text(asset.question_version_id) === versionId)
      .map((asset) => ({
        id: text(asset.id),
        kind: text(asset.kind) as "prompt" | "rationale",
        order: number(asset.asset_order),
        sourcePage: number(asset.source_page),
        dataUrl: `/api/assets/${text(asset.id)}`,
        width: number(asset.width),
        height: number(asset.height),
      }));

    return [
      {
        id: text(question.id),
        sourceId: text(question.source_id),
        versionHash: text(version.version_hash),
        assessment: text(question.assessment, "SAT"),
        section: text(question.section) as Question["section"],
        domain: text(question.domain),
        skill: text(question.skill),
        difficulty: text(question.difficulty) as Question["difficulty"],
        responseType: text(version.response_type) as Question["responseType"],
        acceptedAnswers: answerRows
          .filter((answer) => text(answer.question_version_id) === versionId)
          .map((answer) => ({
            id: text(answer.id),
            value: text(answer.value),
            normalizedValue: text(answer.normalized_value),
          })),
        content: normalizeQuestionContent(version.content),
        promptAssets: mappedAssets.filter((asset) => asset.kind === "prompt"),
        rationaleAssets: mappedAssets.filter(
          (asset) => asset.kind === "rationale",
        ),
        extractedText:
          role === "tutor" ? text(version.extracted_text) : "",
        sourceFileName:
          role === "tutor"
            ? text(sourceDocument?.file_name, "Question Bank PDF")
            : "Private Question Bank",
        importedAt: text(
          sourceDocument?.imported_at,
          text(version.created_at, new Date(0).toISOString()),
        ),
        status: text(question.status) as Question["status"],
        tags: Array.isArray(question.tags) ? (question.tags as string[]) : [],
        reviewNotes: role === "tutor" ? text(version.review_notes) : undefined,
      },
    ];
  });

  const profileMap = new Map(
    profileRows.map((profile) => [text(profile.id), profile]),
  );
  const responses = rows(responsesResult.data);
  const students: Student[] = studentRows.map((student) => {
    const studentId = text(student.user_id);
    const profile = profileMap.get(studentId);
    const completed = attemptRows.filter(
      (attempt) =>
        text(attempt.student_id) === studentId &&
        text(attempt.status) === "submitted",
    );
    const scored = completed.filter(
      (attempt) => number(attempt.raw_total) > 0,
    );
    const averageAccuracy = scored.length
      ? scored.reduce(
          (sum, attempt) =>
            sum + number(attempt.raw_correct) / number(attempt.raw_total, 1),
          0,
        ) / scored.length
      : 0;
    return {
      id: studentId,
      username: text(profile?.username),
      displayName: text(profile?.display_name, "Student"),
      status: text(student.status) as Student["status"],
      mustChangePassword: Boolean(profile?.must_change_password),
      timeMultiplier: number(student.time_multiplier, 1) as Student["timeMultiplier"],
      joinedAt: text(student.joined_at),
      lastActiveAt: text(student.last_active_at) || undefined,
      averageAccuracy,
      assignmentsCompleted: completed.length,
    };
  });

  const tests: TestDefinition[] = testRows.map((test) => ({
    id: text(test.id),
    title: text(test.title),
    description: text(test.description),
    mode: text(test.mode) as TestDefinition["mode"],
    workType: parseWorkType(test.work_type, text(test.mode) as TestDefinition["mode"]),
    status: text(test.status) as TestDefinition["status"],
    routingThreshold: number(test.routing_threshold, 0.6),
    createdAt: text(test.created_at),
    modules: moduleRows
      .filter((module) => text(module.test_id) === text(test.id))
      .map((module) => ({
        id: text(module.id),
        title: text(module.title),
        section: text(module.section) as Question["section"],
        durationMinutes:
          module.duration_minutes === null
            ? null
            : number(module.duration_minutes),
        route: text(module.route) as "common" | "easier" | "harder",
        order: number(module.module_order),
        questions: moduleQuestionRows
          .filter(
            (moduleQuestion) =>
              text(moduleQuestion.module_id) === text(module.id),
          )
          .map((moduleQuestion) => ({
            questionId: text(moduleQuestion.question_id),
            order: number(moduleQuestion.question_order),
            unscored: Boolean(moduleQuestion.unscored),
          })),
      })),
  }));

  const assignmentStudentRows = rows(assignmentStudentsResult.data);
  const assignments: Assignment[] = assignmentRows.map((assignment) => {
    const assignmentRecipients = assignmentStudentRows.filter(
      (assignmentStudent) =>
        text(assignmentStudent.assignment_id) === text(assignment.id),
    );
    return {
      id: text(assignment.id),
      testId: text(assignment.test_id),
      studentIds: assignmentRecipients
        .filter(
          (assignmentStudent) =>
            text(assignmentStudent.recipient_status) !== "excused",
        )
        .map((assignmentStudent) => text(assignmentStudent.student_id)),
      recipients: assignmentRecipients.map((assignmentStudent) => ({
        studentId: text(assignmentStudent.student_id),
        availableAt: text(assignmentStudent.available_at) || undefined,
        dueAt: text(assignmentStudent.due_at) || undefined,
        attemptLimit:
          assignmentStudent.attempt_limit === null
            ? undefined
            : number(assignmentStudent.attempt_limit) || undefined,
        status:
          text(assignmentStudent.recipient_status) === "extended" ||
          text(assignmentStudent.recipient_status) === "excused"
            ? (text(assignmentStudent.recipient_status) as "extended" | "excused")
            : "assigned",
        timeMultiplier: number(assignmentStudent.time_multiplier, 1) as
          AssignmentRecipient["timeMultiplier"],
      })),
      title: text(assignment.title),
      availableAt: text(assignment.available_at),
      dueAt: text(assignment.due_at),
      attemptLimit: number(assignment.attempt_limit, 1),
      feedbackPolicy: text(
        assignment.feedback_policy,
      ) as Assignment["feedbackPolicy"],
      allowResume: Boolean(assignment.allow_resume),
      status: text(assignment.status) as Assignment["status"],
      archivedAt: text(assignment.archived_at) || undefined,
      archivedBy: text(assignment.archived_by) || undefined,
      archivedPreviousStatus:
        text(assignment.archived_previous_status) === "scheduled" ||
        text(assignment.archived_previous_status) === "open" ||
        text(assignment.archived_previous_status) === "closed"
          ? (text(
              assignment.archived_previous_status,
            ) as Assignment["status"])
          : undefined,
    };
  });

  const attempts: Attempt[] = attemptRows.map((attempt) => {
    const deadline = text(attempt.server_deadline);
    const parsedDeadline = deadline ? new Date(deadline).getTime() : 0;
    const route = text(attempt.route);
    return {
      id: text(attempt.id),
      assignmentId: text(attempt.assignment_id),
      studentId: text(attempt.student_id),
      status: text(attempt.status) as Attempt["status"],
      currentModuleId: text(attempt.current_module_id) || undefined,
      currentQuestionIndex: number(attempt.current_question_index),
      answeredCount: number(attempt.answered_count),
      remainingSeconds: parsedDeadline
        ? Math.max(0, Math.ceil((parsedDeadline - Date.now()) / 1000))
        : undefined,
      serverDeadline: deadline || undefined,
      connectionStatus: text(
        attempt.connection_status,
        "offline",
      ) as Attempt["connectionStatus"],
      responses: responses
        .filter((response) => text(response.attempt_id) === text(attempt.id))
        .map((response) => ({
          questionId: text(response.question_id),
          value: text(response.value),
          flagged: Boolean(response.flagged),
          eliminatedChoices: Array.isArray(response.eliminated_choices)
            ? (response.eliminated_choices as string[])
            : [],
          secondsSpent: number(response.seconds_spent),
          changedCount: number(response.changed_count),
        })),
      route:
        route === "easier" || route === "harder" ? route : undefined,
      startedAt: text(attempt.started_at) || undefined,
      submittedAt: text(attempt.submitted_at) || undefined,
      lastHeartbeatAt: text(attempt.last_heartbeat_at) || undefined,
      rawCorrect:
        attempt.raw_correct === null ? undefined : number(attempt.raw_correct),
      rawTotal:
        attempt.raw_total === null ? undefined : number(attempt.raw_total),
      estimatedScore:
        attempt.estimated_score === null
          ? undefined
          : number(attempt.estimated_score),
      scoreRange: parseScoreRange(attempt.score_range),
      scoreSummary: parseScoreSummary(attempt.score_summary),
      released: Boolean(attempt.released),
    };
  });

  const releasedReports: ReleasedReport[] = rows(releasedReportsResult.data).map(
    (report) => {
      const summary =
        typeof report.summary === "object" && report.summary !== null
          ? (report.summary as ReleasedReport["summary"])
          : {};
      return {
        id: text(report.id),
        attemptId: text(report.attempt_id),
        releasedBy: text(report.released_by) || undefined,
        summary,
        releasedAt: text(report.released_at),
      };
    },
  );

  const state: AppState = {
    settings: normalizeTutorSettings(
      settingsRow
        ? {
            displayName: text(settingsRow.display_name),
            landingHeadline: text(settingsRow.landing_headline),
            landingSubheadline: text(settingsRow.landing_subheadline),
            heroEyebrow: text(settingsRow.hero_eyebrow),
            heroTitle: text(settingsRow.hero_title),
            heroSubtitle: text(settingsRow.hero_subtitle),
            timezone: text(settingsRow.timezone),
            defaultDueDays: number(settingsRow.default_due_days, 7),
            defaultAttemptLimit: number(settingsRow.default_attempt_limit, 1),
            defaultFeedbackPolicy: text(
              settingsRow.default_feedback_policy,
              "after_submission",
            ) as AppState["settings"]["defaultFeedbackPolicy"],
            defaultAllowResume: Boolean(settingsRow.default_allow_resume),
          }
        : undefined,
    ),
    questions,
    students,
    tests,
    assignments,
    attempts,
    releasedReports,
  };

  return NextResponse.json(
    { state },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
