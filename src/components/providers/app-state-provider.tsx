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
  Student,
  TestDefinition,
} from "@/lib/domain";
import { demoState } from "@/lib/demo-data";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  persistAssignment,
  persistQuestionChanges,
  persistStudentChanges,
  persistTest,
} from "@/lib/supabase/mutations";

const STORAGE_KEY = "trevors-sat-suite-state-v1";
const emptyState: AppState = {
  questions: [],
  students: [],
  tests: [],
  assignments: [],
  attempts: [],
};

type AppStateContextValue = {
  state: AppState;
  hydrated: boolean;
  loadError: string;
  refresh: () => Promise<void>;
  addQuestions: (questions: Question[]) => void;
  updateQuestion: (id: string, changes: Partial<Question>) => void;
  addStudent: (student: Student) => void;
  updateStudent: (id: string, changes: Partial<Student>) => void;
  addTest: (test: TestDefinition) => void;
  updateTest: (id: string, changes: Partial<TestDefinition>) => void;
  addAssignment: (assignment: Assignment) => void;
  upsertAttempt: (attempt: Attempt) => void;
  resetDemo: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const demo = isDemoMode();
  const shouldLoadRemote =
    pathname.startsWith("/tutor") || pathname.startsWith("/student");
  const [state, setState] = useState<AppState>(demo ? demoState : emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState("");
  const persist = useCallback(
    (operation: () => Promise<void>) => {
      if (demo || !isSupabaseConfigured()) return;
      void operation().catch((error) => {
        setLoadError(
          error instanceof Error ? error.message : "A change could not be saved.",
        );
      });
    },
    [demo],
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
      setState(payload.state);
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
          if (saved) setState(JSON.parse(saved) as AppState);
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

  const resetDemo = useCallback(() => {
    if (!demo) return;
    setState(demoState);
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
      addStudent,
      updateStudent,
      addTest,
      updateTest,
      addAssignment,
      upsertAttempt,
      resetDemo,
    }),
    [
      state,
      hydrated,
      loadError,
      refresh,
      addQuestions,
      updateQuestion,
      addStudent,
      updateStudent,
      addTest,
      updateTest,
      addAssignment,
      upsertAttempt,
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
