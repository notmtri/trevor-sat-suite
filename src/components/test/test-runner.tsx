"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  Clock3,
  EyeOff,
  Flag,
  Highlighter,
  List,
  Menu,
  MessageSquareText,
  Minus,
  PanelRightClose,
  Plus,
  Save,
  ScanLine,
  ScrollText,
  Send,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
} from "lucide-react";
import { QuestionAssetImage } from "@/components/question-asset-image";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { DesmosPanel } from "@/components/test/desmos-panel";
import { ReferenceSheet } from "@/components/test/reference-sheet";
import type {
  Attempt,
  Question,
  ResponseRecord,
  TestModule,
} from "@/lib/domain";
import { isResponseCorrect, scoreResponses } from "@/lib/scoring";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { cn, formatDuration } from "@/lib/utils";

type RunnerStage =
  | "launch"
  | "testing"
  | "module_complete"
  | "break"
  | "submitted";

type RecoveryState = {
  deadline: number;
  moduleIndex: number;
  questionIndex: number;
  responseValues: Record<string, string>;
  flaggedIds: string[];
  eliminated: Record<string, string[]>;
  notes: Record<string, string>;
  highlights: Record<string, Array<{ x: number; y: number }>>;
};

function responseRecords(
  questions: Question[],
  values: Record<string, string>,
  flagged: Set<string>,
  eliminated: Record<string, string[]>,
): ResponseRecord[] {
  return questions.map((question) => ({
    questionId: question.id,
    value: values[question.id] ?? "",
    flagged: flagged.has(question.id),
    eliminatedChoices: eliminated[question.id] ?? [],
    secondsSpent: 0,
    changedCount: 0,
  }));
}

export function TestRunner({ attemptId }: { attemptId: string }) {
  const { state, upsertAttempt, refresh } = useAppState();
  const production = isSupabaseConfigured() && !isDemoMode();
  const assignment =
    state.assignments.find((item) =>
      attemptId === "demo" ? item.status === "open" : item.id === attemptId,
    ) ?? state.assignments[0];
  const test = state.tests.find((item) => item.id === assignment?.testId);
  const existingAttempt = state.attempts.find(
    (item) =>
      item.assignmentId === assignment?.id &&
      (item.status === "not_started" || item.status === "in_progress"),
  );
  const student =
    state.students.find((item) => item.id === existingAttempt?.studentId) ??
    state.students[0];
  const recoveryKey = `trevors-sat-recovery-${attemptId}`;
  const [stage, setStage] = useState<RunnerStage>("launch");
  const [moduleIndex, setModuleIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerHidden, setTimerHidden] = useState(false);
  const [responseValues, setResponseValues] = useState<Record<string, string>>(
    {},
  );
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<
    Record<string, Array<{ x: number; y: number }>>
  >({});
  const [zoom, setZoom] = useState(1);
  const [highlightMode, setHighlightMode] = useState(false);
  const [lineReader, setLineReader] = useState(false);
  const [lineReaderY, setLineReaderY] = useState(50);
  const [notesOpen, setNotesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [phoneBlocked, setPhoneBlocked] = useState(false);
  const [checkedQuestionId, setCheckedQuestionId] = useState<string | null>(
    null,
  );
  const [checkedCorrect, setCheckedCorrect] = useState<boolean | null>(null);
  const [submittedAttempt, setSubmittedAttempt] = useState<Attempt | null>(null);
  const [serverAttemptId, setServerAttemptId] = useState(
    existingAttempt?.id ?? "",
  );
  const [syncError, setSyncError] = useState("");
  const questionAreaRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);

  const modules = useMemo(
    () =>
      (test?.modules ?? [])
        .filter((module) => module.route === "common")
        .sort((a, b) => a.order - b.order),
    [test],
  );
  const activeModule: TestModule | undefined = modules[moduleIndex];
  const activeQuestions = useMemo(
    () =>
      (activeModule?.questions ?? [])
        .sort((a, b) => a.order - b.order)
        .map((item) =>
          state.questions.find((question) => question.id === item.questionId),
        )
        .filter((question): question is Question => Boolean(question)),
    [activeModule, state.questions],
  );
  const activeQuestion = activeQuestions[questionIndex];
  const feedbackImmediate = assignment?.feedbackPolicy === "immediate";
  const isMath = activeModule?.section === "Math";
  const answeredCount = activeQuestions.filter(
    (question) => responseValues[question.id]?.trim(),
  ).length;

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setPhoneBlocked(window.innerWidth < 700);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = stage === "testing" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [stage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(recoveryKey);
        if (!saved) return;
        const recovery = JSON.parse(saved) as RecoveryState;
        if (recovery.deadline <= Date.now()) return;
        setDeadline(recovery.deadline);
        setRemainingSeconds(Math.ceil((recovery.deadline - Date.now()) / 1000));
        setModuleIndex(recovery.moduleIndex);
        setQuestionIndex(recovery.questionIndex);
        setResponseValues(recovery.responseValues);
        setFlagged(new Set(recovery.flaggedIds));
        setEliminated(recovery.eliminated);
        setNotes(recovery.notes);
        setHighlights(recovery.highlights);
      } catch {
        localStorage.removeItem(recoveryKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [recoveryKey]);

  const saveRecovery = useCallback(() => {
    if (!deadline) return;
    const recovery: RecoveryState = {
      deadline,
      moduleIndex,
      questionIndex,
      responseValues,
      flaggedIds: Array.from(flagged),
      eliminated,
      notes,
      highlights,
    };
    localStorage.setItem(recoveryKey, JSON.stringify(recovery));
  }, [
    deadline,
    eliminated,
    flagged,
    highlights,
    moduleIndex,
    notes,
    questionIndex,
    recoveryKey,
    responseValues,
  ]);

  useEffect(() => {
    if (stage !== "testing") return;
    saveRecovery();
  }, [saveRecovery, stage]);

  const submitAttempt = useCallback(
    async (expired = false) => {
      if (!assignment || !test || !student) return;
      if (submittingRef.current) return;
      submittingRef.current = true;
      const allQuestionIds = modules.flatMap((module) =>
        module.questions.map((item) => item.questionId),
      );
      const allQuestions = allQuestionIds
        .map((id) => state.questions.find((question) => question.id === id))
        .filter((question): question is Question => Boolean(question));
      const responses = responseRecords(
        allQuestions,
        responseValues,
        flagged,
        eliminated,
      );
      const score = scoreResponses(allQuestions, responses);
      try {
        let serverResult:
          | {
              attemptId: string;
              status: "submitted" | "expired";
              submittedAt: string;
              released: boolean;
              rawCorrect?: number;
              rawTotal?: number;
            }
          | undefined;
        if (production) {
          if (!serverAttemptId) {
            throw new Error("The attempt has not been started on the server.");
          }
          const response = await fetch("/api/attempts/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: serverAttemptId,
              expired,
              online,
              responses,
            }),
          });
          const payload = (await response.json()) as typeof serverResult & {
            error?: string;
          };
          if (!response.ok) {
            throw new Error(payload?.error ?? "Submission failed.");
          }
          serverResult = payload;
        }
        const attempt: Attempt = {
          id:
            serverResult?.attemptId ??
            (attemptId === "demo"
              ? `student-attempt-${assignment.id}`
              : serverAttemptId || attemptId),
          assignmentId: assignment.id,
          studentId: student.id,
          status: serverResult?.status ?? (expired ? "expired" : "submitted"),
          currentModuleId: activeModule?.id,
          currentQuestionIndex: questionIndex,
          answeredCount: responses.filter((response) => response.value.trim())
            .length,
          connectionStatus: online ? "online" : "offline",
          responses,
          startedAt: new Date(
            deadline -
              (activeModule?.durationMinutes ?? 20) *
                60_000 *
                (student.timeMultiplier ?? 1),
          ).toISOString(),
          submittedAt: serverResult?.submittedAt ?? new Date().toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          rawCorrect: serverResult
            ? serverResult.rawCorrect
            : score.correct,
          rawTotal: serverResult ? serverResult.rawTotal : score.total,
          released:
            serverResult?.released ??
            assignment.feedbackPolicy !== "tutor_release",
        };
        upsertAttempt(attempt);
        setSubmittedAttempt(attempt);
        setStage("submitted");
        setSubmitOpen(false);
        setSyncError("");
        localStorage.removeItem(recoveryKey);
        if (production) void refresh();
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Submission failed.",
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [
      activeModule,
      assignment,
      deadline,
      eliminated,
      flagged,
      modules,
      online,
      questionIndex,
      recoveryKey,
      responseValues,
      production,
      refresh,
      serverAttemptId,
      state.questions,
      student,
      test,
      attemptId,
      upsertAttempt,
    ],
  );

  useEffect(() => {
    if (stage !== "testing" || !deadline) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) void submitAttempt(true);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, stage, submitAttempt]);

  useEffect(() => {
    if (stage !== "testing" || !assignment || !student || !activeModule) return;
    const heartbeat = () => {
      const responses = responseRecords(
        activeQuestions,
        responseValues,
        flagged,
        eliminated,
      );
      const localAttempt: Attempt = {
        id:
          attemptId === "demo"
            ? `student-attempt-${assignment.id}`
            : serverAttemptId || attemptId,
        assignmentId: assignment.id,
        studentId: student.id,
        status: "in_progress",
        currentModuleId: activeModule.id,
        currentQuestionIndex: questionIndex,
        answeredCount,
        remainingSeconds,
        connectionStatus: online ? "online" : "offline",
        responses,
        startedAt: new Date(
          deadline -
            activeModule.durationMinutes *
              60_000 *
              (student.timeMultiplier ?? 1),
        ).toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
        released: false,
      };
      upsertAttempt(localAttempt);
      if (production && serverAttemptId && online) {
        void fetch("/api/attempts/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: serverAttemptId,
            moduleId: activeModule.id,
            currentQuestionIndex: questionIndex,
            answeredCount,
            online,
            responses,
          }),
        }).then(async (response) => {
          if (response.ok) {
            setSyncError("");
            return;
          }
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          setSyncError(payload.error ?? "Remote save failed.");
        });
      }
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 15_000);
    return () => window.clearInterval(interval);
  }, [
    activeModule,
    activeQuestions,
    answeredCount,
    assignment,
    deadline,
    eliminated,
    flagged,
    online,
    questionIndex,
    remainingSeconds,
    responseValues,
    production,
    serverAttemptId,
    stage,
    student,
    upsertAttempt,
    attemptId,
  ]);

  useEffect(() => {
    if (stage !== "testing") return;
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key === "ArrowRight" && questionIndex < activeQuestions.length - 1) {
        setQuestionIndex((value) => value + 1);
      }
      if (event.key === "ArrowLeft" && questionIndex > 0) {
        setQuestionIndex((value) => value - 1);
      }
      if (
        activeQuestion?.responseType === "multiple_choice" &&
        /^[a-d]$/i.test(event.key)
      ) {
        setResponseValues((values) => ({
          ...values,
          [activeQuestion.id]: event.key.toUpperCase(),
        }));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeQuestion, activeQuestions.length, questionIndex, stage]);

  async function startModule() {
    if (!activeModule || !student) return;
    try {
      let nextDeadline =
        deadline > Date.now()
          ? deadline
          : Date.now() +
            activeModule.durationMinutes *
              60_000 *
              (student.timeMultiplier ?? 1);
      if (production) {
        const response = await fetch("/api/attempts/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignment?.id,
            moduleId: activeModule.id,
            attemptId: serverAttemptId || undefined,
          }),
        });
        const payload = (await response.json()) as {
          attemptId?: string;
          deadline?: string;
          error?: string;
        };
        if (!response.ok || !payload.attemptId || !payload.deadline) {
          throw new Error(payload.error ?? "The module could not be started.");
        }
        setServerAttemptId(payload.attemptId);
        nextDeadline = new Date(payload.deadline).getTime();
      }
      setDeadline(nextDeadline);
      setRemainingSeconds(Math.ceil((nextDeadline - Date.now()) / 1000));
      setSyncError("");
      setStage("testing");
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "The module could not be started.",
      );
    }
  }

  async function checkAnswer() {
    if (!activeQuestion || !assignment) return;
    setCheckedQuestionId(activeQuestion.id);
    if (!production) {
      setCheckedCorrect(isResponseCorrect(activeQuestion, selected));
      return;
    }
    try {
      const response = await fetch("/api/attempts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          questionId: activeQuestion.id,
          value: selected,
        }),
      });
      const payload = (await response.json()) as {
        correct?: boolean;
        error?: string;
      };
      if (!response.ok || payload.correct === undefined) {
        throw new Error(payload.error ?? "Answer check failed.");
      }
      setCheckedCorrect(payload.correct);
    } catch (error) {
      setCheckedCorrect(null);
      setSyncError(
        error instanceof Error ? error.message : "Answer check failed.",
      );
    }
  }

  function completeModule() {
    if (moduleIndex >= modules.length - 1) {
      setSubmitOpen(true);
      return;
    }
    setStage("module_complete");
  }

  function beginNextModule() {
    const nextIndex = moduleIndex + 1;
    const previousSection = modules[moduleIndex]?.section;
    const nextSection = modules[nextIndex]?.section;
    setModuleIndex(nextIndex);
    setQuestionIndex(0);
    setDeadline(0);
    setRemainingSeconds(0);
    setCheckedQuestionId(null);
    setStage(
      previousSection === "Reading and Writing" && nextSection === "Math"
        ? "break"
        : "launch",
    );
  }

  function toggleEliminated(choice: string) {
    if (!activeQuestion) return;
    setEliminated((current) => {
      const choices = new Set(current[activeQuestion.id] ?? []);
      if (choices.has(choice)) choices.delete(choice);
      else choices.add(choice);
      return { ...current, [activeQuestion.id]: Array.from(choices) };
    });
  }

  function addHighlight(event: React.PointerEvent<HTMLDivElement>) {
    if (!highlightMode || !activeQuestion || !questionAreaRef.current) return;
    const rect = questionAreaRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setHighlights((current) => ({
      ...current,
      [activeQuestion.id]: [
        ...(current[activeQuestion.id] ?? []),
        { x, y },
      ],
    }));
  }

  if (!assignment || !test || !activeModule || !student) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" />
        <h1 className="mt-4 text-xl font-black">Assignment unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          This assignment has no published module or its questions are missing.
        </p>
        <Link
          href="/student"
          className="mt-5 inline-flex font-bold text-[var(--blue)]"
        >
          Return to dashboard
        </Link>
      </Card>
    );
  }

  if (phoneBlocked && stage !== "submitted") {
    return (
      <div className="fixed inset-0 z-[200] grid place-items-center bg-[var(--wash)] p-6">
        <Card className="max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-2xl font-black">Use a larger screen</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tests require a laptop or tablet so questions and tools remain
            readable. Phones can still access the dashboard and results.
          </p>
          <Link
            href="/student"
            className="mt-6 inline-flex rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-bold text-white"
          >
            Return to dashboard
          </Link>
        </Card>
      </div>
    );
  }

  if (stage === "launch" || stage === "break" || stage === "module_complete") {
    const isBreak = stage === "break";
    const moduleDone = stage === "module_complete";
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[var(--wash)] p-5">
        <Card className="w-full max-w-2xl overflow-hidden">
          <div className="bg-[var(--navy)] px-8 py-7 text-white">
            <p className="text-sm font-bold text-blue-100">{test.title}</p>
            <h1 className="mt-2 text-3xl font-black">
              {isBreak
                ? "Section break"
                : moduleDone
                  ? "Module complete"
                  : activeModule.title}
            </h1>
          </div>
          <div className="p-8">
            {isBreak ? (
              <>
                <Clock3 className="h-10 w-10 text-[var(--blue)]" />
                <p className="mt-5 text-lg font-bold">
                  Take the official-style break before Math.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Your Reading and Writing answers are locked. Continue when
                  you are ready to begin the next section.
                </p>
              </>
            ) : moduleDone ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-[var(--green)]" />
                <p className="mt-5 text-lg font-bold">
                  Your answers for {activeModule.title} are saved.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  You cannot return after moving to the next module.
                </p>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Questions
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {activeQuestions.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Time
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {Math.round(
                        activeModule.durationMinutes * student.timeMultiplier,
                      )}{" "}
                      min
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Calculator
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {isMath ? "Available" : "No"}
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border p-4 text-sm leading-6 text-slate-600">
                  Responses save automatically in this browser and synchronize
                  through a heartbeat. The timer is based on an absolute
                  deadline and continues if the connection drops.
                </div>
              </>
            )}
            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <Link
                href="/student"
                className="inline-flex h-11 items-center px-3 text-sm font-bold text-slate-500"
              >
                Exit to dashboard
              </Link>
              <Button
                size="lg"
                onClick={
                  moduleDone
                    ? beginNextModule
                    : isBreak
                      ? () => setStage("launch")
                      : startModule
                }
              >
                {moduleDone
                  ? "Continue"
                  : isBreak
                    ? "Continue to Math"
                    : deadline > 0
                      ? "Resume module"
                      : "Start module"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            {syncError && (
              <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {syncError}
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (stage === "submitted" && submittedAttempt) {
    const released = submittedAttempt.released;
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--wash)] p-5 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <Card className="overflow-hidden">
            <div className="bg-[var(--navy)] px-7 py-8 text-white">
              <CheckCircle2 className="h-10 w-10 text-emerald-300" />
              <h1 className="mt-5 text-3xl font-black">Assignment submitted</h1>
              <p className="mt-2 text-blue-100">
                {released
                  ? "Your tutor has allowed results after submission."
                  : "Your tutor will release results when review is complete."}
              </p>
            </div>
            <div className="p-7">
              {released ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Correct
                      </p>
                      <p className="mt-2 text-3xl font-black">
                        {submittedAttempt.rawCorrect} / {submittedAttempt.rawTotal}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Accuracy
                      </p>
                      <p className="mt-2 text-3xl font-black">
                        {Math.round(
                          ((submittedAttempt.rawCorrect ?? 0) /
                            Math.max(1, submittedAttempt.rawTotal ?? 1)) *
                            100,
                        )}
                        %
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Score type
                      </p>
                      <p className="mt-2 text-lg font-black">Raw practice result</p>
                    </div>
                  </div>
                  <div className="mt-7 space-y-5">
                    {activeQuestions.map((question, index) => {
                      const value = responseValues[question.id] ?? "";
                      const correct = isResponseCorrect(question, value);
                      return (
                        <div key={question.id} className="rounded-2xl border p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <p className="font-black">Question {index + 1}</p>
                            <Badge tone={correct ? "green" : "rose"}>
                              {correct ? "Correct" : "Review"}
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            {question.rationaleAssets.map((asset) => (
                              <QuestionAssetImage
                                key={asset.id}
                                asset={asset}
                                alt={`Rationale for question ${index + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                  Correct answers and rationales are locked until your tutor
                  releases this report.
                </div>
              )}
              <Link
                href="/student"
                className="mt-7 inline-flex h-12 items-center rounded-xl bg-[var(--navy)] px-5 font-bold text-white"
              >
                Return to dashboard
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!activeQuestion) return null;

  const selected = responseValues[activeQuestion.id] ?? "";
  const currentHighlights = highlights[activeQuestion.id] ?? [];
  const currentEliminated = eliminated[activeQuestion.id] ?? [];
  const visibleCheckedCorrect =
    checkedQuestionId === activeQuestion.id ? checkedCorrect : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-3 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
            onClick={() => setMenuOpen(true)}
            aria-label="Open question menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-black">{activeModule.title}</p>
            <p className="text-xs text-slate-500">{activeModule.section}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTimerHidden((value) => !value)}
          className={cn(
            "focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-sm font-black",
            remainingSeconds <= 300
              ? "bg-amber-50 text-amber-800"
              : "bg-slate-100 text-[var(--navy-dark)]",
          )}
          aria-label={timerHidden ? "Show timer" : "Hide timer"}
        >
          {timerHidden ? <EyeOff className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
          {timerHidden ? "Timer hidden" : formatDuration(remainingSeconds)}
        </button>
        <div className="flex items-center gap-2">
          <Badge tone={online ? "green" : "rose"}>
            {online ? (
              <Wifi className="mr-1 h-3 w-3" />
            ) : (
              <WifiOff className="mr-1 h-3 w-3" />
            )}
            {online ? "Saved" : "Offline"}
          </Badge>
          <button
            type="button"
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl",
              flagged.has(activeQuestion.id)
                ? "bg-amber-100 text-amber-700"
                : "hover:bg-slate-100",
            )}
            onClick={() =>
              setFlagged((current) => {
                const next = new Set(current);
                if (next.has(activeQuestion.id)) next.delete(activeQuestion.id);
                else next.add(activeQuestion.id);
                return next;
              })
            }
            aria-label="Mark for review"
          >
            <Flag className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="scrollbar-thin min-w-0 flex-1 overflow-y-auto bg-[#f5f6f8]">
          <div className="mx-auto max-w-5xl p-4 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--navy)] text-sm font-black text-white">
                  {questionIndex + 1}
                </span>
                <span className="text-sm font-bold text-slate-500">
                  of {activeQuestions.length}
                </span>
                {flagged.has(activeQuestion.id) && (
                  <Badge tone="amber">Marked for review</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-xl border bg-white p-1">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"
                  onClick={() => setZoom((value) => Math.max(0.75, value - 0.1))}
                  aria-label="Zoom out"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-xs font-bold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"
                  onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
                  aria-label="Zoom in"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={questionAreaRef}
              className={cn(
                "relative overflow-auto rounded-2xl border bg-white p-4 shadow-sm sm:p-6",
                highlightMode && "cursor-crosshair ring-2 ring-amber-300",
              )}
              onPointerDown={addHighlight}
              onPointerMove={(event) => {
                if (!lineReader || !questionAreaRef.current) return;
                const rect = questionAreaRef.current.getBoundingClientRect();
                setLineReaderY(
                  Math.max(
                    0,
                    Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
                  ),
                );
              }}
            >
              <div
                className="mx-auto origin-top transition-transform"
                style={{
                  width: `${100 / zoom}%`,
                  transform: `scale(${zoom})`,
                  marginBottom: `${Math.max(0, (zoom - 1) * 45)}%`,
                }}
              >
                <div className="space-y-3">
                  {activeQuestion.promptAssets.map((asset) => (
                    <QuestionAssetImage
                      key={asset.id}
                      asset={asset}
                      alt={`Question ${questionIndex + 1}`}
                    />
                  ))}
                </div>
              </div>
              {currentHighlights.map((highlight, index) => (
                <button
                  key={`${highlight.x}-${highlight.y}-${index}`}
                  type="button"
                  aria-label="Remove highlight"
                  className="absolute h-5 w-28 -translate-x-1/2 -translate-y-1/2 rounded bg-yellow-300/45 hover:bg-rose-300/50"
                  style={{ left: `${highlight.x}%`, top: `${highlight.y}%` }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setHighlights((current) => ({
                      ...current,
                      [activeQuestion.id]: currentHighlights.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }));
                  }}
                />
              ))}
              {lineReader && (
                <div
                  className="pointer-events-none absolute inset-x-0 h-10 border-y-2 border-blue-500/35 bg-blue-100/20 shadow-[0_-2000px_0_1980px_rgba(15,23,42,.22),0_2000px_0_1980px_rgba(15,23,42,.22)]"
                  style={{ top: `calc(${lineReaderY}% - 20px)` }}
                />
              )}
            </div>

            <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-black">Your answer</p>
                <span className="text-xs font-semibold text-slate-400">
                  {activeQuestion.responseType === "multiple_choice"
                    ? "Select one answer"
                    : "Enter one accepted value"}
                </span>
              </div>
              {activeQuestion.responseType === "multiple_choice" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {["A", "B", "C", "D"].map((choice) => {
                    const struck = currentEliminated.includes(choice);
                    return (
                      <div key={choice} className="flex gap-2">
                        <button
                          type="button"
                          className={cn(
                            "focus-ring flex h-12 flex-1 items-center gap-3 rounded-xl border px-4 text-left font-black transition",
                            selected === choice
                              ? "border-[var(--blue)] bg-blue-50 text-[var(--navy)] ring-2 ring-blue-100"
                              : "hover:bg-slate-50",
                            struck && "text-slate-400 line-through",
                          )}
                          onClick={() =>
                            setResponseValues((current) => ({
                              ...current,
                              [activeQuestion.id]: choice,
                            }))
                          }
                        >
                          <span
                            className={cn(
                              "grid h-7 w-7 place-items-center rounded-full border text-xs",
                              selected === choice &&
                                "border-[var(--blue)] bg-[var(--blue)] text-white",
                            )}
                          >
                            {choice}
                          </span>
                          Choice {choice}
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "grid h-12 w-12 place-items-center rounded-xl border",
                            struck
                              ? "bg-slate-100 text-slate-700"
                              : "text-slate-400 hover:bg-slate-50",
                          )}
                          title={`Eliminate choice ${choice}`}
                          onClick={() => toggleEliminated(choice)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <input
                  value={selected}
                  onChange={(event) =>
                    setResponseValues((current) => ({
                      ...current,
                      [activeQuestion.id]: event.target.value,
                    }))
                  }
                  className="focus-ring mt-4 h-12 w-full max-w-sm rounded-xl border px-4 text-lg font-bold"
                  inputMode="decimal"
                  aria-label="Student-produced response"
                  placeholder="Enter your answer"
                />
              )}
              {feedbackImmediate && selected && (
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void checkAnswer()}
                  >
                    Check answer
                  </Button>
                  {visibleCheckedCorrect !== null && (
                    <span
                      className={cn(
                        "ml-3 text-sm font-bold",
                        visibleCheckedCorrect
                          ? "text-emerald-700"
                          : "text-rose-700",
                      )}
                    >
                      {visibleCheckedCorrect
                        ? "Correct"
                        : "Not yet. Review your work and try again."}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {notesOpen && (
          <aside className="hidden w-80 shrink-0 border-l bg-white p-5 lg:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black">Question notes</p>
                <p className="text-xs text-slate-500">
                  Private and saved automatically
                </p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
                onClick={() => setNotesOpen(false)}
              >
                <PanelRightClose className="h-5 w-5" />
              </button>
            </div>
            <Textarea
              className="mt-5 min-h-56"
              value={notes[activeQuestion.id] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [activeQuestion.id]: event.target.value,
                }))
              }
              placeholder="Write a note about your reasoning..."
            />
            <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Save className="h-3.5 w-3.5" /> Saved in recovery state
            </p>
          </aside>
        )}
      </div>

      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-white px-3 py-2 sm:px-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              "focus-ring grid h-10 w-10 place-items-center rounded-xl",
              highlightMode
                ? "bg-amber-100 text-amber-800"
                : "hover:bg-slate-100",
            )}
            onClick={() => setHighlightMode((value) => !value)}
            title="Highlight image region"
          >
            <Highlighter className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={cn(
              "focus-ring grid h-10 w-10 place-items-center rounded-xl",
              lineReader
                ? "bg-blue-100 text-blue-800"
                : "hover:bg-slate-100",
            )}
            onClick={() => setLineReader((value) => !value)}
            title="Line reader"
          >
            <ScanLine className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={cn(
              "focus-ring grid h-10 w-10 place-items-center rounded-xl",
              notesOpen
                ? "bg-violet-100 text-violet-800"
                : "hover:bg-slate-100",
            )}
            onClick={() => setNotesOpen((value) => !value)}
            title="Notes"
          >
            <MessageSquareText className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="focus-ring grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
            onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
            title="Zoom"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          {isMath && (
            <>
              <button
                type="button"
                className="focus-ring grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
                onClick={() => setReferenceOpen(true)}
                title="Reference sheet"
              >
                <ScrollText className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="focus-ring grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
                onClick={() => setCalculatorOpen(true)}
                title="Desmos calculator"
              >
                <Calculator className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            disabled={questionIndex === 0}
            onClick={() => {
              setQuestionIndex((value) => value - 1);
              setCheckedQuestionId(null);
            }}
          >
            Back
          </Button>
          {questionIndex < activeQuestions.length - 1 ? (
            <Button
              onClick={() => {
                setQuestionIndex((value) => value + 1);
                setCheckedQuestionId(null);
              }}
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              icon={<Send className="h-4 w-4" />}
              onClick={completeModule}
            >
              {moduleIndex < modules.length - 1 ? "Finish module" : "Submit"}
            </Button>
          )}
        </div>
      </div>

      <DesmosPanel
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />
      <ReferenceSheet open={referenceOpen} onOpenChange={setReferenceOpen} />

      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Close className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100">
              <X className="h-5 w-5" />
            </Dialog.Close>
            <Dialog.Title className="flex items-center gap-2 text-xl font-black">
              <List className="h-5 w-5" /> Question menu
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              Answered questions are filled. Flags mark questions to review.
            </Dialog.Description>
            <div className="mt-6 grid grid-cols-5 gap-3 sm:grid-cols-8">
              {activeQuestions.map((question, index) => {
                const answered = Boolean(responseValues[question.id]?.trim());
                const marked = flagged.has(question.id);
                return (
                  <Dialog.Close asChild key={question.id}>
                    <button
                      type="button"
                      onClick={() => setQuestionIndex(index)}
                      className={cn(
                        "relative grid aspect-square place-items-center rounded-xl border text-sm font-black",
                        answered
                          ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                          : "bg-white hover:bg-slate-50",
                        questionIndex === index && "ring-3 ring-blue-200",
                      )}
                    >
                      {index + 1}
                      {marked && (
                        <Flag className="absolute -right-1 -top-1 h-4 w-4 fill-amber-400 text-amber-600" />
                      )}
                    </button>
                  </Dialog.Close>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm">
              <span className="font-semibold text-slate-500">
                {answeredCount} of {activeQuestions.length} answered
              </span>
              <Dialog.Close asChild>
                <Button>Return to test</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={submitOpen} onOpenChange={setSubmitOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Title className="text-xl font-black">
              Submit your assignment?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
              You answered {answeredCount} of {activeQuestions.length} questions
              in this module. Once submitted, you cannot change these answers.
            </Dialog.Description>
            {answeredCount < activeQuestions.length && (
              <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                {activeQuestions.length - answeredCount} question
                {activeQuestions.length - answeredCount === 1 ? "" : "s"} remain
                unanswered.
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary">Keep working</Button>
              </Dialog.Close>
              <Button
                icon={<Check className="h-4 w-4" />}
                onClick={() => void submitAttempt(false)}
              >
                Submit
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
