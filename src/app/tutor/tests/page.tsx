"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  Check,
  Copy,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import type {
  Assignment,
  Question,
  TestDefinition,
  TestModule,
  WorkType,
} from "@/lib/domain";
import {
  getAssignmentRecipients,
  getEffectiveAssignmentWindow,
} from "@/lib/assignment-utils";
import {
  CHOICE_LABELS,
  compactQuestionContent,
  formatChoiceLabel,
  normalizeQuestionContent,
  questionHasTypedContent,
  questionPreviewText,
  questionSearchText,
  validateQuestionContent,
} from "@/lib/question-content";
import { makeAcceptedAnswers } from "@/lib/scoring";
import {
  modulesForWorkType,
  questionCountForTest,
  validateTestForAssignment,
  WORK_TYPE_CONFIGS,
  WORK_TYPES,
  workTypeLabel,
} from "@/lib/work-types";

function shiftDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function sortModuleQuestions(module: TestModule) {
  return [...module.questions].sort((a, b) => a.order - b.order);
}

export default function TestsPage() {
  const {
    state,
    addTest,
    updateQuestion,
    updateTest,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    restoreAssignment,
  } = useAppState();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState<WorkType>("custom");
  const [customSection, setCustomSection] =
    useState<Question["section"]>("Math");
  const [customDuration, setCustomDuration] = useState(20);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState<Record<string, string>>({});
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(
    null,
  );
  const [assignmentMutationId, setAssignmentMutationId] = useState<
    string | null
  >(null);
  const [assignmentMutationError, setAssignmentMutationError] = useState("");
  const [questionToEdit, setQuestionToEdit] = useState<Question | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState("");

  const publishedQuestions = useMemo(
    () => state.questions.filter((question) => question.status === "published"),
    [state.questions],
  );
  const activeTest = state.tests.find((test) => test.id === activeTestId);
  const activeAssignments = state.assignments.filter(
    (assignment) =>
      assignment.testId === activeTestId && !assignment.archivedAt,
  );
  const deletedAssignments = state.assignments.filter(
    (assignment) =>
      assignment.testId === activeTestId && Boolean(assignment.archivedAt),
  );
  const activeTestAssigned = state.assignments.some(
    (assignment) => assignment.testId === activeTestId,
  );
  const usedQuestionIds = useMemo(
    () =>
      new Set(
        activeTest?.modules.flatMap((module) =>
          module.questions.map((question) => question.questionId),
        ) ?? [],
      ),
    [activeTest],
  );
  const activeStudents = state.students.filter(
    (student) => student.status === "active",
  );
  const filteredStudents = activeStudents.filter((student) =>
    `${student.displayName} ${student.username}`
      .toLowerCase()
      .includes(studentSearch.trim().toLowerCase()),
  );
  const validation = activeTest
    ? validateTestForAssignment(activeTest)
    : { valid: false, errors: [] };
  const assignmentToDelete = state.assignments.find(
    (assignment) => assignment.id === deleteAssignmentId,
  );
  const deletionAttempts = state.attempts.filter(
    (attempt) => attempt.assignmentId === deleteAssignmentId,
  );
  const deletionActiveCount = deletionAttempts.filter((attempt) =>
    ["not_started", "in_progress"].includes(attempt.status),
  ).length;
  const deletionCompletedCount = deletionAttempts.filter((attempt) =>
    ["submitted", "expired"].includes(attempt.status),
  ).length;
  const questionAnswerLocked = Boolean(
    questionToEdit &&
      state.tests.some(
        (test) =>
          state.assignments.some((assignment) => assignment.testId === test.id) &&
          test.modules.some((module) =>
            module.questions.some(
              (placement) => placement.questionId === questionToEdit.id,
            ),
          ),
      ),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("build") !== "1") return;
      setBuilderOpen(true);
      url.searchParams.delete("build");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function buildDraft() {
    const id = crypto.randomUUID();
    const config = WORK_TYPE_CONFIGS[workType];
    const modules = modulesForWorkType(workType);
    const customModules =
      workType === "custom"
        ? modules.map((module) => ({
            ...module,
            title: `${customSection} Custom Practice`,
            section: customSection,
            durationMinutes: customDuration,
          }))
        : modules;
    const test: TestDefinition = {
      id,
      title: title.trim(),
      description: config.description,
      mode: config.mode,
      workType,
      status: "draft",
      routingThreshold: 0.6,
      modules: customModules,
      createdAt: new Date().toISOString(),
    };
    addTest(test);
    setActiveTestId(id);
    setBuilderOpen(false);
    setTitle("");
    setWorkType("custom");
    setCustomSection("Math");
    setCustomDuration(20);
  }

  function duplicateActiveTest() {
    if (!activeTest) return;
    const duplicate: TestDefinition = {
      ...activeTest,
      id: crypto.randomUUID(),
      title: `${activeTest.title} copy`,
      status: "draft",
      createdAt: new Date().toISOString(),
      modules: activeTest.modules.map((module) => ({
        ...module,
        id: crypto.randomUUID(),
        questions: module.questions.map((question) => ({ ...question })),
      })),
    };
    addTest(duplicate);
    setActiveTestId(duplicate.id);
  }

  function updateModule(moduleId: string, changes: Partial<TestModule>) {
    if (!activeTest || activeTestAssigned) return;
    updateTest(activeTest.id, {
      modules: activeTest.modules.map((module) =>
        module.id === moduleId ? { ...module, ...changes } : module,
      ),
    });
  }

  function addQuestionToModule(moduleId: string, questionId: string) {
    if (!activeTest || activeTestAssigned) return;
    if (
      activeTest.modules.some((module) =>
        module.questions.some((question) => question.questionId === questionId),
      )
    ) {
      return;
    }
    updateTest(activeTest.id, {
      modules: activeTest.modules.map((module) => {
        if (module.id !== moduleId) return module;
        return {
          ...module,
          questions: [
            ...sortModuleQuestions(module),
            { questionId, order: module.questions.length + 1 },
          ],
        };
      }),
    });
  }

  function removeQuestion(moduleId: string, questionId: string) {
    if (!activeTest || activeTestAssigned) return;
    updateTest(activeTest.id, {
      modules: activeTest.modules.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              questions: sortModuleQuestions(module)
                .filter((question) => question.questionId !== questionId)
                .map((question, index) => ({ ...question, order: index + 1 })),
            },
      ),
    });
  }

  function assignTest() {
    if (!activeTest || !selectedStudentIds.length || !validation.valid) return;
    const availableAt = new Date();
    const dueAt = new Date(availableAt);
    dueAt.setDate(dueAt.getDate() + state.settings.defaultDueDays);
    const assignment: Assignment = {
      id: crypto.randomUUID(),
      testId: activeTest.id,
      studentIds: selectedStudentIds,
      recipients: selectedStudentIds.map((studentId) => ({
        studentId,
        status: "assigned",
        attemptLimit: state.settings.defaultAttemptLimit,
      })),
      title: activeTest.title,
      availableAt: availableAt.toISOString(),
      dueAt: dueAt.toISOString(),
      attemptLimit: state.settings.defaultAttemptLimit,
      feedbackPolicy: "after_submission",
      allowResume: state.settings.defaultAllowResume,
      status: "open",
    };
    addAssignment(assignment);
    updateTest(activeTest.id, { status: "published" });
    setAssignmentOpen(false);
    setStudentSearch("");
  }

  function openAssignmentDialog() {
    setSelectedStudentIds(activeStudents.map((student) => student.id));
    setStudentSearch("");
    setAssignmentOpen(true);
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  function updateRecipient(
    assignment: Assignment,
    studentId: string,
    changes: Partial<NonNullable<Assignment["recipients"]>[number]>,
  ) {
    const recipients = getAssignmentRecipients(assignment);
    const existing = recipients.find(
      (recipient) => recipient.studentId === studentId,
    );
    const nextRecipient = {
      ...(existing ?? { studentId, status: "assigned" as const }),
      ...changes,
    };
    const nextRecipients = recipients.some(
      (recipient) => recipient.studentId === studentId,
    )
      ? recipients.map((recipient) =>
          recipient.studentId === studentId ? nextRecipient : recipient,
        )
      : [...recipients, nextRecipient];
    updateAssignment(assignment.id, {
      recipients: nextRecipients,
      studentIds: nextRecipients
        .filter((recipient) => recipient.status !== "excused")
        .map((recipient) => recipient.studentId),
    });
  }

  async function archiveSelectedAssignment() {
    if (!assignmentToDelete || assignmentMutationId) return;
    setAssignmentMutationId(assignmentToDelete.id);
    setAssignmentMutationError("");
    try {
      await deleteAssignment(assignmentToDelete.id);
      setDeleteAssignmentId(null);
    } catch (error) {
      setAssignmentMutationError(
        error instanceof Error
          ? error.message
          : "The assignment could not be deleted.",
      );
    } finally {
      setAssignmentMutationId(null);
    }
  }

  async function restoreDeletedAssignment(assignmentId: string) {
    if (assignmentMutationId) return;
    setAssignmentMutationId(assignmentId);
    setAssignmentMutationError("");
    try {
      await restoreAssignment(assignmentId);
    } catch (error) {
      setAssignmentMutationError(
        error instanceof Error
          ? error.message
          : "The assignment could not be restored.",
      );
    } finally {
      setAssignmentMutationId(null);
    }
  }

  function openQuestionEditor(question: Question) {
    setQuestionToEdit({ ...question });
    setQuestionAnswer(
      question.acceptedAnswers.map((answer) => answer.value).join(", "),
    );
  }

  function saveQuestionEdits() {
    if (!questionToEdit) return;
    const answerValues =
      questionToEdit.responseType === "multiple_choice"
        ? [questionAnswer.trim().toUpperCase()]
        : questionAnswer.split(",");
    const acceptedAnswers = makeAcceptedAnswers(answerValues);
    if (
      !questionToEdit.domain.trim() ||
      !questionToEdit.skill.trim() ||
      !acceptedAnswers.length
    ) {
      return;
    }
    updateQuestion(questionToEdit.id, {
      domain: questionToEdit.domain.trim(),
      skill: questionToEdit.skill.trim(),
      difficulty: questionToEdit.difficulty,
      ...(questionAnswerLocked ? {} : { acceptedAnswers }),
    });
    setQuestionToEdit(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Authoring"
        title="Tests & assignments"
        description="Create questions, build one of the six test types, and assign it to students."
        actions={
          <>
            <Link
              href="/tutor/import/manual"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add question
            </Link>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setBuilderOpen(true)}
            >
              Build test
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {state.tests.map((test) => {
            const questionCount = questionCountForTest(test);
            return (
              <button
                key={test.id}
                type="button"
                onClick={() => setActiveTestId(test.id)}
                className={`focus-ring block w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
                  activeTestId === test.id
                    ? "border-[var(--blue)] ring-2 ring-blue-100"
                    : "hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={test.mode === "exam" ? "blue" : "green"}>
                    {workTypeLabel(test.workType)}
                  </Badge>
                  <Badge tone={test.status === "published" ? "green" : "amber"}>
                    {test.status}
                  </Badge>
                </div>
                <p className="mt-4 font-black">{test.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {questionCount} questions · {test.modules.length} modules
                </p>
              </button>
            );
          })}
        </div>

        {activeTest ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={activeTest.mode === "exam" ? "blue" : "green"}>
                    {workTypeLabel(activeTest.workType)}
                  </Badge>
                  {validation.valid ? (
                    <Badge tone="green">Ready to assign</Badge>
                  ) : (
                    <Badge tone="amber">Needs setup</Badge>
                  )}
                </div>
                <h2 className="mt-3 text-2xl font-black">{activeTest.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeTest.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={duplicateActiveTest}
                >
                  Duplicate
                </Button>
                <Button
                  icon={<CalendarClock className="h-4 w-4" />}
                  disabled={!validation.valid}
                  onClick={openAssignmentDialog}
                >
                  Assign
                </Button>
              </div>
            </div>

            <div className="p-6">
              {activeTestAssigned && (
                <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  This test has been assigned, so its question order and contents
                  are locked. Duplicate it to create an editable version.
                </div>
              )}
              {!validation.valid && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-black">Template checklist</p>
                  <ul className="mt-2 list-inside list-disc">
                    {validation.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-5">
                {activeTest.modules
                  .filter((module) => module.route === "common")
                  .sort((a, b) => a.order - b.order)
                  .map((module) => {
                    const template =
                      WORK_TYPE_CONFIGS[activeTest.workType].modules[
                        module.order - 1
                      ];
                    const moduleQuestions = sortModuleQuestions(module);
                    const search = moduleSearch[module.id]?.toLowerCase() ?? "";
                    const available = publishedQuestions
                      .filter((question) => question.section === module.section)
                      .filter((question) => !usedQuestionIds.has(question.id))
                      .filter((question) =>
                        `${question.sourceId} ${question.domain} ${question.skill} ${(question.tags ?? []).join(" ")}`
                          .toLowerCase()
                          .includes(search),
                      )
                      .slice(0, 12);
                    return (
                      <div key={module.id} className="rounded-2xl border">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4">
                          <div>
                            <p className="font-extrabold">{module.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {module.durationMinutes === null
                                ? "Unlimited time"
                                : `${module.durationMinutes} minutes`} ·{" "}
                              {module.questions.length} question
                              {module.questions.length === 1 ? "" : "s"}
                              {template
                                ? ` · target ${template.questionCount}`
                                : ""}
                            </p>
                          </div>
                          <Badge tone="blue">{module.section}</Badge>
                        </div>

                        {!activeTestAssigned && (
                          <div className="grid gap-3 border-b p-4 sm:grid-cols-2">
                            {activeTest.workType === "custom" && (
                              <div>
                                <FieldLabel htmlFor={`section-${module.id}`}>
                                  Section
                                </FieldLabel>
                                <Select
                                  id={`section-${module.id}`}
                                  value={module.section}
                                  onChange={(event) =>
                                    updateModule(module.id, {
                                      section: event.target
                                        .value as Question["section"],
                                      questions: [],
                                    })
                                  }
                                >
                                  <option>Math</option>
                                  <option>Reading and Writing</option>
                                </Select>
                              </div>
                            )}
                            <div>
                              <FieldLabel>Time limit</FieldLabel>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex rounded-lg border bg-slate-50 p-1">
                                  <button
                                    type="button"
                                    className={`rounded-md px-3 py-2 text-sm font-bold ${
                                      module.durationMinutes !== null
                                        ? "bg-white text-[var(--navy)] shadow-sm"
                                        : "text-slate-500"
                                    }`}
                                    onClick={() =>
                                      updateModule(module.id, {
                                        durationMinutes:
                                          template?.durationMinutes ?? 20,
                                      })
                                    }
                                  >
                                    Timed
                                  </button>
                                  <button
                                    type="button"
                                    className={`rounded-md px-3 py-2 text-sm font-bold ${
                                      module.durationMinutes === null
                                        ? "bg-white text-[var(--navy)] shadow-sm"
                                        : "text-slate-500"
                                    }`}
                                    onClick={() =>
                                      updateModule(module.id, {
                                        durationMinutes: null,
                                      })
                                    }
                                  >
                                    Unlimited
                                  </button>
                                </div>
                                {module.durationMinutes !== null && (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`duration-${module.id}`}
                                      className="w-24"
                                      type="number"
                                      min={1}
                                      max={240}
                                      value={module.durationMinutes}
                                      onChange={(event) =>
                                        updateModule(module.id, {
                                          durationMinutes: Number(
                                            event.target.value,
                                          ),
                                        })
                                      }
                                    />
                                    <span className="text-sm font-semibold text-slate-500">
                                      min
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="divide-y">
                          {moduleQuestions.map((item, index) => {
                            const question = state.questions.find(
                              (candidate) => candidate.id === item.questionId,
                            );
                            return (
                              <div
                                key={item.questionId}
                                className="flex items-center gap-3 px-5 py-3"
                              >
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold">
                                    {question?.sourceId} · {question?.skill}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {question?.difficulty} ·{" "}
                                    {question?.responseType === "multiple_choice"
                                      ? "A-D"
                                      : "SPR"}
                                  </p>
                                </div>
                                {question && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    icon={<Pencil className="h-4 w-4" />}
                                    disabled={activeTestAssigned}
                                    onClick={() => openQuestionEditor(question)}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<Trash2 className="h-4 w-4" />}
                                  aria-label={`Remove question ${question?.sourceId ?? index + 1}`}
                                  disabled={activeTestAssigned}
                                  onClick={() =>
                                    removeQuestion(
                                      module.id,
                                      item.questionId,
                                    )
                                  }
                                />
                              </div>
                            );
                          })}
                          {!moduleQuestions.length && (
                            <div className="px-5 py-8 text-center text-sm text-slate-500">
                              Add questions from the library table below.
                            </div>
                          )}
                        </div>

                        {!activeTestAssigned && (
                          <div className="border-t bg-slate-50 p-4">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                              <Input
                                className="pl-10"
                                value={moduleSearch[module.id] ?? ""}
                                onChange={(event) =>
                                  setModuleSearch((current) => ({
                                    ...current,
                                    [module.id]: event.target.value,
                                  }))
                                }
                                placeholder={`Search published ${module.section} questions`}
                              />
                            </div>
                            <div className="mt-3 overflow-hidden rounded-xl border bg-white">
                              <div className="max-h-72 overflow-y-auto">
                                {available.map((question) => (
                                  <div
                                    key={question.id}
                                    className="grid gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto]"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold">
                                        {question.sourceId} · {question.skill}
                                      </p>
                                      <p className="truncate text-xs text-slate-500">
                                        {question.domain} · {question.difficulty}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        addQuestionToModule(
                                          module.id,
                                          question.id,
                                        )
                                      }
                                    >
                                      Add
                                    </Button>
                                  </div>
                                ))}
                                {!available.length && (
                                  <p className="p-5 text-center text-sm text-slate-500">
                                    No available published questions match this
                                    module.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="mt-8 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black">Assignments</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Manage due dates, retakes, and release policy for this
                      test.
                    </p>
                  </div>
                </div>
                {assignmentMutationError && (
                  <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                    {assignmentMutationError}
                  </p>
                )}
                {activeAssignments.map((assignment) => (
                  <div key={assignment.id} className="rounded-2xl border p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{assignment.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {assignment.studentIds.length} active recipient
                          {assignment.studentIds.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            updateAssignment(assignment.id, {
                              dueAt: shiftDays(assignment.dueAt, 7),
                            })
                          }
                        >
                          Extend all 7 days
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            assignment.status === "closed"
                              ? "secondary"
                              : "danger"
                          }
                          onClick={() =>
                            updateAssignment(assignment.id, {
                              status:
                                assignment.status === "closed"
                                  ? "open"
                                  : "closed",
                            })
                          }
                        >
                          {assignment.status === "closed" ? "Reopen" : "Close"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => {
                            setAssignmentMutationError("");
                            setDeleteAssignmentId(assignment.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <FieldLabel htmlFor={`available-${assignment.id}`}>
                          Available
                        </FieldLabel>
                        <Input
                          id={`available-${assignment.id}`}
                          type="datetime-local"
                          value={toDateTimeLocal(assignment.availableAt)}
                          onChange={(event) =>
                            updateAssignment(assignment.id, {
                              availableAt: fromDateTimeLocal(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`due-${assignment.id}`}>
                          Due
                        </FieldLabel>
                        <Input
                          id={`due-${assignment.id}`}
                          type="datetime-local"
                          value={toDateTimeLocal(assignment.dueAt)}
                          onChange={(event) =>
                            updateAssignment(assignment.id, {
                              dueAt: fromDateTimeLocal(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`limit-${assignment.id}`}>
                          Attempts
                        </FieldLabel>
                        <Input
                          id={`limit-${assignment.id}`}
                          type="number"
                          min={1}
                          max={20}
                          value={assignment.attemptLimit}
                          onChange={(event) =>
                            updateAssignment(assignment.id, {
                              attemptLimit: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`status-${assignment.id}`}>
                          Status
                        </FieldLabel>
                        <Select
                          id={`status-${assignment.id}`}
                          value={assignment.status}
                          onChange={(event) =>
                            updateAssignment(assignment.id, {
                              status:
                                event.target.value as Assignment["status"],
                            })
                          }
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        <span>Student</span>
                        <span>Window</span>
                        <span>Actions</span>
                      </div>
                      <div className="divide-y">
                        {getAssignmentRecipients(assignment).map((recipient) => {
                          const student = state.students.find(
                            (item) => item.id === recipient.studentId,
                          );
                          const window = getEffectiveAssignmentWindow(
                            assignment,
                            recipient.studentId,
                          );
                          return (
                            <div
                              key={recipient.studentId}
                              className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto_auto] md:items-center"
                            >
                              <div>
                                <p className="text-sm font-bold">
                                  {student?.displayName ?? "Student"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {recipient.status} · {window.attemptLimit}{" "}
                                  attempt
                                  {window.attemptLimit === 1 ? "" : "s"}
                                </p>
                              </div>
                              <p className="text-xs font-semibold text-slate-500">
                                Due{" "}
                                {new Intl.DateTimeFormat("en-US", {
                                  month: "short",
                                  day: "numeric",
                                }).format(new Date(window.dueAt))}
                              </p>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    updateRecipient(
                                      assignment,
                                      recipient.studentId,
                                      {
                                        status: "extended",
                                        dueAt: shiftDays(window.dueAt, 7),
                                      },
                                    )
                                  }
                                >
                                  Extend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<RotateCcw className="h-4 w-4" />}
                                  onClick={() =>
                                    updateRecipient(
                                      assignment,
                                      recipient.studentId,
                                      {
                                        attemptLimit: window.attemptLimit + 1,
                                      },
                                    )
                                  }
                                >
                                  Retake
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<Archive className="h-4 w-4" />}
                                  onClick={() =>
                                    updateRecipient(
                                      assignment,
                                      recipient.studentId,
                                      { status: "excused" },
                                    )
                                  }
                                >
                                  Excuse
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {!activeAssignments.length && (
                  <div className="rounded-2xl border px-5 py-8 text-center text-sm text-slate-500">
                    Assign this test to students to manage availability,
                    retakes, and release controls.
                  </div>
                )}
                {deletedAssignments.length > 0 && (
                  <details className="overflow-hidden rounded-2xl border bg-slate-50">
                    <summary className="cursor-pointer px-5 py-4 text-sm font-black text-slate-700">
                      Deleted assignments ({deletedAssignments.length})
                    </summary>
                    <div className="divide-y border-t bg-white">
                      {deletedAssignments.map((assignment) => {
                        const attemptCount = state.attempts.filter(
                          (attempt) => attempt.assignmentId === assignment.id,
                        ).length;
                        return (
                          <div
                            key={assignment.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                          >
                            <div>
                              <p className="text-sm font-bold">
                                {assignment.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Deleted{" "}
                                {assignment.archivedAt
                                  ? new Intl.DateTimeFormat("en-US", {
                                      dateStyle: "medium",
                                    }).format(new Date(assignment.archivedAt))
                                  : "recently"}
                                {" - "}
                                {assignment.studentIds.length} recipient
                                {assignment.studentIds.length === 1 ? "" : "s"}
                                {" - "}
                                {attemptCount} attempt
                                {attemptCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<RotateCcw className="h-4 w-4" />}
                              loading={assignmentMutationId === assignment.id}
                              onClick={() =>
                                void restoreDeletedAssignment(assignment.id)
                              }
                            >
                              Restore
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="grid min-h-[460px] place-items-center p-8 text-center">
            <div>
              <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-4 font-bold">Choose a test to edit</p>
              <p className="mt-1 text-sm text-slate-500">
                Or build a new draft from one of the six SAT work types.
              </p>
            </div>
          </Card>
        )}
      </div>

      <Dialog.Root
        open={Boolean(assignmentToDelete)}
        onOpenChange={(open) => {
          if (!open && !assignmentMutationId) setDeleteAssignmentId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Title className="text-xl font-black">
              Delete {assignmentToDelete?.title}?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
              This removes the assignment from student dashboards and cancels
              active work. Released results remain available, and you can
              restore the assignment later.
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xl font-black">
                  {assignmentToDelete?.studentIds.length ?? 0}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  Recipients
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xl font-black">{deletionCompletedCount}</p>
                <p className="text-xs font-semibold text-slate-500">
                  Completed
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xl font-black text-amber-900">
                  {deletionActiveCount}
                </p>
                <p className="text-xs font-semibold text-amber-800">Active</p>
              </div>
            </div>
            {deletionActiveCount > 0 && (
              <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Active attempts will be marked expired and cannot be resumed.
              </div>
            )}
            {assignmentMutationError && (
              <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {assignmentMutationError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={Boolean(assignmentMutationId)}
                onClick={() => setDeleteAssignmentId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                loading={assignmentMutationId === assignmentToDelete?.id}
                onClick={() => void archiveSelectedAssignment()}
              >
                Delete assignment
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={Boolean(questionToEdit)}
        onOpenChange={(open) => {
          if (!open) setQuestionToEdit(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Close
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
            <Dialog.Title className="text-xl font-black">
              Edit {questionToEdit?.sourceId}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              Update the question details and answer key used for scoring.
            </Dialog.Description>

            {questionToEdit && (
              <div className="mt-5 space-y-4">
                <div>
                  <FieldLabel htmlFor="edit-question-domain">Domain</FieldLabel>
                  <Input
                    id="edit-question-domain"
                    value={questionToEdit.domain}
                    onChange={(event) =>
                      setQuestionToEdit((current) =>
                        current ? { ...current, domain: event.target.value } : null,
                      )
                    }
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="edit-question-skill">Skill</FieldLabel>
                  <Input
                    id="edit-question-skill"
                    value={questionToEdit.skill}
                    onChange={(event) =>
                      setQuestionToEdit((current) =>
                        current ? { ...current, skill: event.target.value } : null,
                      )
                    }
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="edit-question-difficulty">
                    Difficulty
                  </FieldLabel>
                  <Select
                    id="edit-question-difficulty"
                    value={questionToEdit.difficulty}
                    onChange={(event) =>
                      setQuestionToEdit((current) =>
                        current
                          ? {
                              ...current,
                              difficulty: event.target
                                .value as Question["difficulty"],
                            }
                          : null,
                      )
                    }
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="edit-question-answer">
                    Correct answer
                  </FieldLabel>
                  {questionToEdit.responseType === "multiple_choice" ? (
                    <Select
                      id="edit-question-answer"
                      value={questionAnswer}
                      disabled={questionAnswerLocked}
                      onChange={(event) => setQuestionAnswer(event.target.value)}
                    >
                      {["A", "B", "C", "D"].map((answer) => (
                        <option key={answer}>{answer}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id="edit-question-answer"
                      value={questionAnswer}
                      disabled={questionAnswerLocked}
                      onChange={(event) => setQuestionAnswer(event.target.value)}
                      placeholder="Separate accepted answers with commas"
                    />
                  )}
                  {questionAnswerLocked && (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      The answer key is locked because this question has
                      assignment history.
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  icon={<Check className="h-4 w-4" />}
                  disabled={
                    !questionToEdit.domain.trim() ||
                    !questionToEdit.skill.trim() ||
                    !questionAnswer.trim()
                  }
                  onClick={saveQuestionEdits}
                >
                  Save question
                </Button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={builderOpen} onOpenChange={setBuilderOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Close
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
            <Dialog.Title className="text-xl font-black">
              Build an assisted draft
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm leading-6 text-slate-500">
              Choose the work type first. The app creates fixed module slots;
              you fill them from the question bank table.
            </Dialog.Description>
            <div className="mt-5 space-y-4">
              <div>
                <FieldLabel htmlFor="test-title">Test title</FieldLabel>
                <Input
                  id="test-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Functions Review"
                />
              </div>
              <div>
                <FieldLabel htmlFor="test-work-type">Work type</FieldLabel>
                <Select
                  id="test-work-type"
                  value={workType}
                  onChange={(event) =>
                    setWorkType(event.target.value as WorkType)
                  }
                >
                  {WORK_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {WORK_TYPE_CONFIGS[item].label}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {WORK_TYPE_CONFIGS[workType].description}
                </p>
              </div>
              {workType === "custom" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="custom-section">Section</FieldLabel>
                    <Select
                      id="custom-section"
                      value={customSection}
                      onChange={(event) =>
                        setCustomSection(event.target.value as Question["section"])
                      }
                    >
                      <option>Math</option>
                      <option>Reading and Writing</option>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="custom-duration">Minutes</FieldLabel>
                    <Input
                      id="custom-duration"
                      type="number"
                      min={1}
                      max={240}
                      value={customDuration}
                      onChange={(event) =>
                        setCustomDuration(Number(event.target.value))
                      }
                    />
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <strong>{publishedQuestions.length}</strong> published questions
                are available. Strict templates cannot be assigned until every
                module reaches its exact count.
              </div>
            </div>
            <Button
              className="mt-6 w-full"
              icon={<Sparkles className="h-4 w-4" />}
              disabled={!title.trim()}
              onClick={buildDraft}
            >
              Create module slots
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={assignmentOpen}
        onOpenChange={(open) => {
          setAssignmentOpen(open);
          if (!open) setStudentSearch("");
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Close
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
            <Dialog.Title className="text-xl font-black">
              Assign {activeTest?.title}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              This assignment opens now, is due in{" "}
              {state.settings.defaultDueDays} days, allows{" "}
              {state.settings.defaultAttemptLimit} attempt
              {state.settings.defaultAttemptLimit === 1 ? "" : "s"}, and
              respects each selected student&apos;s time multiplier.
            </Dialog.Description>
            <div className="mt-5 overflow-hidden rounded-xl border">
              <div className="border-b bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-[var(--blue)]" />
                    <div>
                      <p className="text-sm font-bold">
                        {selectedStudentIds.length} of {activeStudents.length}{" "}
                        selected
                      </p>
                      <p className="text-xs text-slate-500">
                        Choose exactly who receives this assignment
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs font-bold">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-[var(--blue)] hover:bg-blue-50"
                      onClick={() =>
                        setSelectedStudentIds(
                          activeStudents.map((student) => student.id),
                        )
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                      onClick={() => setSelectedStudentIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {activeStudents.length > 5 && (
                  <Input
                    className="mt-3"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search students"
                    aria-label="Search students"
                  />
                )}
              </div>
              <div className="scrollbar-thin max-h-64 divide-y overflow-y-auto">
                {filteredStudents.map((student) => {
                  const checked = selectedStudentIds.includes(student.id);
                  return (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-[var(--navy)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {student.displayName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          @{student.username}
                        </p>
                      </div>
                      <Badge>{student.timeMultiplier}x time</Badge>
                    </label>
                  );
                })}
                {!filteredStudents.length && (
                  <p className="p-5 text-center text-sm text-slate-500">
                    No active students match this search.
                  </p>
                )}
              </div>
            </div>
            <Button
              className="mt-6 w-full"
              icon={<Check className="h-4 w-4" />}
              disabled={!selectedStudentIds.length || !validation.valid}
              onClick={assignTest}
            >
              Publish to {selectedStudentIds.length} student
              {selectedStudentIds.length === 1 ? "" : "s"}
            </Button>
            {!selectedStudentIds.length && (
              <p className="mt-3 text-center text-sm font-semibold text-amber-700">
                Select at least one active student before publishing.
              </p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
