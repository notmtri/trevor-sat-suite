"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Copy,
  FileText,
  Plus,
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
import { FieldLabel, Input, Select } from "@/components/ui/field";
import type {
  Assignment,
  FeedbackPolicy,
  TestDefinition,
  TestModule,
} from "@/lib/domain";

export default function TestsPage() {
  const {
    state,
    addTest,
    updateTest,
    addAssignment,
  } = useAppState();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [feedbackPolicy, setFeedbackPolicy] =
    useState<FeedbackPolicy>("after_submission");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const publishedQuestions = useMemo(
    () => state.questions.filter((question) => question.status === "published"),
    [state.questions],
  );
  const activeTest = state.tests.find((test) => test.id === activeTestId);
  const activeTestAssigned = state.assignments.some(
    (assignment) => assignment.testId === activeTestId,
  );
  const activeStudents = state.students.filter(
    (student) => student.status === "active",
  );
  const filteredStudents = activeStudents.filter((student) =>
    `${student.displayName} ${student.username}`
      .toLowerCase()
      .includes(studentSearch.trim().toLowerCase()),
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
    const grouped = [
      {
        section: "Reading and Writing" as const,
        questions: publishedQuestions.filter(
          (question) => question.section === "Reading and Writing",
        ),
        duration: mode === "exam" ? 32 : 20,
      },
      {
        section: "Math" as const,
        questions: publishedQuestions.filter(
          (question) => question.section === "Math",
        ),
        duration: mode === "exam" ? 35 : 20,
      },
    ].filter((group) => group.questions.length);
    const modules: TestModule[] = grouped.map((group, index) => ({
      id: crypto.randomUUID(),
      title: `${group.section} Module 1`,
      section: group.section,
      durationMinutes: group.duration,
      route: "common",
      order: index + 1,
      questions: group.questions.map((question, questionIndex) => ({
        questionId: question.id,
        order: questionIndex + 1,
        unscored:
          mode === "exam" &&
          questionIndex >= Math.max(0, group.questions.length - 2),
      })),
    }));
    const test: TestDefinition = {
      id,
      title: title.trim(),
      description:
        mode === "exam"
          ? "Adaptive SAT simulation with unofficial score estimate."
          : "Tutor-built targeted practice.",
      mode,
      status: "draft",
      routingThreshold: 0.6,
      modules,
      createdAt: new Date().toISOString(),
    };
    addTest(test);
    setActiveTestId(id);
    setBuilderOpen(false);
    setTitle("");
  }

  function moveQuestion(
    test: TestDefinition,
    moduleId: string,
    index: number,
    direction: -1 | 1,
  ) {
    updateTest(test.id, {
      modules: test.modules.map((module) => {
        if (module.id !== moduleId) return module;
        const questions = [...module.questions];
        const target = index + direction;
        if (target < 0 || target >= questions.length) return module;
        [questions[index], questions[target]] = [
          questions[target],
          questions[index],
        ];
        return {
          ...module,
          questions: questions.map((question, order) => ({
            ...question,
            order: order + 1,
          })),
        };
      }),
    });
  }

  function removeQuestion(
    test: TestDefinition,
    moduleId: string,
    questionId: string,
  ) {
    if (activeTestAssigned) return;
    updateTest(test.id, {
      modules: test.modules.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              questions: module.questions
                .filter((question) => question.questionId !== questionId)
                .map((question, index) => ({
                  ...question,
                  order: index + 1,
                })),
            },
      ),
    });
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

  function assignTest() {
    if (!activeTest || !selectedStudentIds.length) return;
    const availableAt = new Date();
    const dueAt = new Date(availableAt);
    dueAt.setDate(dueAt.getDate() + 7);
    const assignment: Assignment = {
      id: crypto.randomUUID(),
      testId: activeTest.id,
      studentIds: selectedStudentIds,
      title: activeTest.title,
      availableAt: availableAt.toISOString(),
      dueAt: dueAt.toISOString(),
      attemptLimit: 1,
      feedbackPolicy,
      allowResume: true,
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

  return (
    <>
      <PageHeader
        eyebrow="Authoring"
        title="Tests & assignments"
        description="Build targeted practice manually or let the assistant draft modules from your published library."
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setBuilderOpen(true)}
          >
            Build test
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {state.tests.map((test) => {
            const questionCount = test.modules.reduce(
              (sum, module) => sum + module.questions.length,
              0,
            );
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
                <div className="flex items-center justify-between">
                  <Badge tone={test.mode === "exam" ? "blue" : "green"}>
                    {test.mode}
                  </Badge>
                  <Badge
                    tone={test.status === "published" ? "green" : "amber"}
                  >
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
                <div className="flex gap-2">
                  <Badge tone={activeTest.mode === "exam" ? "blue" : "green"}>
                    {activeTest.mode}
                  </Badge>
                  {activeTest.mode === "exam" && (
                    <Badge tone="amber">
                      Unofficial adaptive simulation
                    </Badge>
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
                  disabled={!activeTest.modules.length}
                  onClick={openAssignmentDialog}
                >
                  Assign
                </Button>
              </div>
            </div>

            <div className="p-6">
              {activeTest.mode === "exam" && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  The routing threshold is{" "}
                  <strong>{Math.round(activeTest.routingThreshold * 100)}%</strong>.
                  Add easier and harder Module 2 branches before publishing a
                  full adaptive simulation. Operational College Board scoring is
                  not reproduced.
                </div>
              )}
              {activeTestAssigned && (
                <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  This test has been assigned, so its question order and
                  contents are locked. Duplicate it to create an editable
                  version without changing student attempts.
                </div>
              )}
              {activeTest.modules.length ? (
                <div className="space-y-5">
                  {activeTest.modules.map((module) => (
                    <div key={module.id} className="rounded-2xl border">
                      <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
                        <div>
                          <p className="font-extrabold">{module.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {module.durationMinutes} minutes ·{" "}
                            {module.questions.length} questions · {module.route} route
                          </p>
                        </div>
                        <Badge tone="blue">{module.section}</Badge>
                      </div>
                      <div className="divide-y">
                        {module.questions.map((item, index) => {
                          const question = state.questions.find(
                            (candidate) => candidate.id === item.questionId,
                          );
                          return (
                            <div
                              key={item.questionId}
                              className="flex items-center gap-3 px-5 py-3"
                              draggable
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
                                    ? "A–D"
                                    : "SPR"}
                                </p>
                              </div>
                              {item.unscored && (
                                <Badge tone="amber">simulated unscored</Badge>
                              )}
                              <div className="flex">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<ArrowUp className="h-4 w-4" />}
                                  disabled={activeTestAssigned || index === 0}
                                  onClick={() =>
                                    moveQuestion(activeTest, module.id, index, -1)
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<ArrowDown className="h-4 w-4" />}
                                  disabled={
                                    activeTestAssigned ||
                                    index === module.questions.length - 1
                                  }
                                  onClick={() =>
                                    moveQuestion(activeTest, module.id, index, 1)
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<Trash2 className="h-4 w-4" />}
                                  aria-label={`Remove question ${question?.sourceId ?? index + 1}`}
                                  disabled={activeTestAssigned}
                                  onClick={() =>
                                    removeQuestion(
                                      activeTest,
                                      module.id,
                                      item.questionId,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 font-bold">No modules yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Import and publish enough questions to build this test.
                  </p>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="grid min-h-[460px] place-items-center p-8 text-center">
            <div>
              <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-4 font-bold">Choose a test to edit</p>
              <p className="mt-1 text-sm text-slate-500">
                Or build a new assisted draft from your published questions.
              </p>
            </div>
          </Card>
        )}
      </div>

      <Dialog.Root open={builderOpen} onOpenChange={setBuilderOpen}>
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
              Build an assisted draft
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm leading-6 text-slate-500">
              The initial modules use available section, skill, and difficulty
              coverage. You can reorder every question before assigning.
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
                <FieldLabel htmlFor="test-mode">Mode</FieldLabel>
                <Select
                  id="test-mode"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as "practice" | "exam")
                  }
                >
                  <option value="practice">Practice set</option>
                  <option value="exam">Full SAT simulation</option>
                </Select>
              </div>
              <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <strong>{publishedQuestions.length}</strong> published questions
                are available. A full SAT requires 98 question placements plus
                adaptive Module 2 branches.
              </div>
            </div>
            <Button
              className="mt-6 w-full"
              icon={<Sparkles className="h-4 w-4" />}
              disabled={!title.trim() || !publishedQuestions.length}
              onClick={buildDraft}
            >
              Generate draft
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
              This assignment opens now, is due in seven days, allows one
              attempt, and respects each selected student&apos;s time
              multiplier.
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
                      <Badge>{student.timeMultiplier}× time</Badge>
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
            <div className="mt-4">
              <FieldLabel htmlFor="feedback-release">
                Feedback release
              </FieldLabel>
              <Select
                id="feedback-release"
                value={feedbackPolicy}
                onChange={(event) =>
                  setFeedbackPolicy(event.target.value as FeedbackPolicy)
                }
              >
                <option value="immediate">Immediately during practice</option>
                <option value="after_submission">After submission</option>
                <option value="tutor_release">Only when tutor releases</option>
              </Select>
            </div>
            <Button
              className="mt-6 w-full"
              icon={<Check className="h-4 w-4" />}
              disabled={!selectedStudentIds.length}
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
