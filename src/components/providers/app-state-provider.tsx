"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  AppState,
  Assignment,
  Attempt,
  Question,
  ReleasedReport,
  Student,
  TestDefinition,
  TutorSettings,
} from "@/lib/domain";
import { demoState } from "@/lib/demo-data";
import { normalizeTutorSettings } from "@/lib/settings";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  persistAssignment,
  persistAssignmentChanges,
  persistAttemptChanges,
  persistQuestionChanges,
  persistQuestionDelete,
  persistStudentChanges,
  persistTutorSettings,
  persistTest,
} from "@/lib/supabase/mutations";

const STORAGE_KEY = "trevors-sat-suite-state-v1";
const emptyState: AppState = {
  settings: normalizeTutorSettings(undefined),
  questions: [],
  students: [],
  tests: [],
  assignments: [],
  attempts: [],
  releasedReports: [],
};

function normalizeAppState(state: Partial<AppState>): AppState {
  return {
    ...emptyState,
    ...state,
    settings: normalizeTutorSettings(state.settings),
    questions: state.questions ?? [],
    students: state.students ?? [],
    tests: (state.tests ?? []).map((test) => ({
      ...test,
      workType:
        test.workType ?? (test.mode === "exam" ? "full_length" : "custom"),
    })),
    assignments: state.assignments ?? [],
    attempts: state.attempts ?? [],
    releasedReports: state.releasedReports ?? [],
  };
}

type AppStateContextValue = {
  state: AppState;
  hydrated: boolean;
  loadError: string;
  refresh: () => Promise<void>;
  addQuestions: (questions: Question[]) => void;
  updateQuestion: (id: string, changes: Partial<Question>) => void;
  deleteQuestion: (id: string) => Promise<void>;
  addStudent: (student: Student) => void;
  updateStudent: (id: string, changes: Partial<Student>) => void;
  addTest: (test: TestDefinition) => void;
  updateTest: (id: string, changes: Partial<TestDefinition>) => void;
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (id: string, changes: Partial<Assignment>) => void;
  upsertAttempt: (attempt: Attempt) => void;
  updateAttempt: (
    id: string,
    changes: Partial<Attempt>,
    report?: ReleasedReport,
  ) => void;
  upsertReleasedReport: (report: ReleasedReport) => void;
  updateSettings: (changes: Partial<TutorSettings>) => void;
  resetDemo: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const demo = isDemoMode();
  const shouldLoadRemote =
    pathname.startsWith("/tutor") || pathname.startsWith("/student");
  const [state, setState] = useState<AppState>(
    demo ? normalizeAppState(demoState) : emptyState,
  );
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState("");
  const persist = useCallback(
    (operation: () => Promise<void>) => {
      if (demo || !isSupabaseConfigured()) return;
      void operation().catch(async (error) => {
        setLoadError(
          error instanceof Error ? error.message : "A change could not be saved.",
        );
        if (!shouldLoadRemote) return;
        const response = await fetch("/api/state", { cache: "no-store" }).catch(
          () => null,
        );
        if (!response?.ok) return;
        const payload = (await response.json().catch(() => ({}))) as {
          state?: AppState;
        };
        if (payload.state) setState(normalizeAppState(payload.state));
      });
    },
    [demo, shouldLoadRemote],
  );

  const refresh = useCallback(async () => {
    if (demo || !shouldLoadRemote || !isSupabaseConfigured()) return;
    setLoadError("");
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      const payload = (await response.json()) as {
        state?: AppState;
        error?: string;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? "Application data could not be loaded.");
      }
      setState(normalizeAppState(payload.state));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Application data could not be loaded.",
      );
    }
  }, [demo, shouldLoadRemote]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (demo) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setState(normalizeAppState(JSON.parse(saved) as AppState));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        } finally {
          setHydrated(true);
        }
        return;
      }
      if (shouldLoadRemote) {
        void refresh().finally(() => setHydrated(true));
      } else {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demo, refresh, shouldLoadRemote]);

  useEffect(() => {
    if (demo && hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [demo, hydrated, state]);

  const addQuestions = useCallback((questions: Question[]) => {
    setState((current) => {
      const next = [...current.questions];
      for (const question of questions) {
        const existing = next.findIndex(
          (item) =>
            item.sourceId === question.sourceId &&
            item.versionHash === question.versionHash,
        );
        if (existing >= 0) next[existing] = question;
        else next.unshift(question);
      }
      return { ...current, questions: next };
    });
  }, []);

  const updateQuestion = useCallback(
    (id: string, changes: Partial<Question>) => {
      setState((current) => ({
        ...current,
        questions: current.questions.map((question) =>
          question.id === id ? { ...question, ...changes } : question,
        ),
      }));
      persist(() => persistQuestionChanges(id, changes));
    },
    [persist],
  );

  const deleteQuestion = useCallback(
    async (id: string) => {
      const usedByTest = state.tests.some((test) =>
        test.modules.some((module) =>
          module.questions.some((question) => question.questionId === id),
        ),
      );
      const usedByAttempt = state.attempts.some((attempt) =>
        attempt.responses.some((response) => response.questionId === id),
      );
      if (usedByTest || usedByAttempt) {
        throw new Error(
          usedByAttempt
            ? "This question has student responses and cannot be deleted."
            : "Remove this question from every test before deleting it.",
        );
      }
      if (!demo && isSupabaseConfigured()) {
        await persistQuestionDelete(id);
      }
      setState((current) => ({
        ...current,
        questions: current.questions.filter((question) => question.id !== id),
      }));
    },
    [demo, state.attempts, state.tests],
  );

  const addStudent = useCallback((student: Student) => {
    setState((current) => ({
      ...current,
      students: [student, ...current.students],
    }));
  }, []);

  const updateStudent = useCallback(
    (id: string, changes: Partial<Student>) => {
      setState((current) => ({
        ...current,
        students: current.students.map((student) =>
          student.id === id ? { ...student, ...changes } : student,
        ),
      }));
      persist(() => persistStudentChanges(id, changes));
    },
    [persist],
  );

  const addTest = useCallback((test: TestDefinition) => {
    setState((current) => ({
      ...current,
      tests: [test, ...current.tests],
    }));
    persist(() => persistTest(test));
  }, [persist]);

  const updateTest = useCallback(
    (id: string, changes: Partial<TestDefinition>) => {
      setState((current) => {
        const updated = current.tests.map((test) =>
          test.id === id ? { ...test, ...changes } : test,
        );
        const changedTest = updated.find((test) => test.id === id);
        if (changedTest) persist(() => persistTest(changedTest));
        return { ...current, tests: updated };
      });
    },
    [persist],
  );

  const addAssignment = useCallback((assignment: Assignment) => {
    setState((current) => ({
      ...current,
      assignments: [assignment, ...current.assignments],
    }));
    persist(() => persistAssignment(assignment));
  }, [persist]);

  const updateAssignment = useCallback(
    (id: string, changes: Partial<Assignment>) => {
      setState((current) => ({
        ...current,
        assignments: current.assignments.map((assignment) =>
          assignment.id === id ? { ...assignment, ...changes } : assignment,
        ),
      }));
      persist(() => persistAssignmentChanges(id, changes));
    },
    [persist],
  );

  const upsertAttempt = useCallback((attempt: Attempt) => {
    setState((current) => {
      const existing = current.attempts.findIndex(
        (item) => item.id === attempt.id,
      );
      const attempts = [...current.attempts];
      if (existing >= 0) attempts[existing] = attempt;
      else attempts.unshift(attempt);
      return { ...current, attempts };
    });
  }, []);

  const upsertReleasedReport = useCallback((report: ReleasedReport) => {
    setState((current) => {
      const existing = current.releasedReports.findIndex(
        (item) => item.attemptId === report.attemptId,
      );
      const releasedReports = [...current.releasedReports];
      if (existing >= 0) releasedReports[existing] = report;
      else releasedReports.unshift(report);
      return { ...current, releasedReports };
    });
  }, []);

  const updateAttempt = useCallback(
    (id: string, changes: Partial<Attempt>, report?: ReleasedReport) => {
      setState((current) => {
        const attempts = current.attempts.map((attempt) =>
          attempt.id === id ? { ...attempt, ...changes } : attempt,
        );
        let releasedReports = current.releasedReports;
        if (report) {
          const existing = releasedReports.findIndex(
            (item) => item.attemptId === report.attemptId,
          );
          releasedReports = [...releasedReports];
          if (existing >= 0) releasedReports[existing] = report;
          else releasedReports.unshift(report);
        } else if (changes.released === false) {
          releasedReports = releasedReports.filter(
            (item) => item.attemptId !== id,
          );
        }
        return { ...current, attempts, releasedReports };
      });
      persist(() => persistAttemptChanges(id, changes, report));
    },
    [persist],
  );

  const updateSettings = useCallback(
    (changes: Partial<TutorSettings>) => {
      let nextSettings: TutorSettings | undefined;
      setState((current) => ({
        ...current,
        settings: (nextSettings = normalizeTutorSettings({
          ...current.settings,
          ...changes,
        })),
      }));
      persist(() => persistTutorSettings(nextSettings ?? changes));
    },
    [persist],
  );

  const resetDemo = useCallback(() => {
    if (!demo) return;
    setState(normalizeAppState(demoState));
    localStorage.removeItem(STORAGE_KEY);
  }, [demo]);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      loadError,
      refresh,
      addQuestions,
      updateQuestion,
      deleteQuestion,
      addStudent,
      updateStudent,
      addTest,
      updateTest,
      addAssignment,
      updateAssignment,
      upsertAttempt,
      updateAttempt,
      upsertReleasedReport,
      updateSettings,
      resetDemo,
    }),
    [
      state,
      hydrated,
      loadError,
      refresh,
      addQuestions,
      updateQuestion,
      deleteQuestion,
      addStudent,
      updateStudent,
      addTest,
      updateTest,
      addAssignment,
      updateAssignment,
      upsertAttempt,
      updateAttempt,
      upsertReleasedReport,
      updateSettings,
      resetDemo,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
