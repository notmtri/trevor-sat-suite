"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isDemoMode } from "@/lib/supabase/client";

function isDemoAssignment() {
  return isDemoMode();
}

export default function StudentDashboard() {
  const { state } = useAppState();
  const student = state.students[0];
  const assignment = state.assignments.find((item) => item.status === "open");
  const test = state.tests.find((item) => item.id === assignment?.testId);
  const studentAttempts = state.attempts.filter(
    (attempt) => attempt.studentId === student?.id,
  );
  const scoredAttempts = studentAttempts.filter(
    (attempt) =>
      attempt.released &&
      attempt.rawCorrect !== undefined &&
      (attempt.rawTotal ?? 0) > 0,
  );
  const recentAccuracy = scoredAttempts.length
    ? scoredAttempts.reduce(
        (sum, attempt) =>
          sum + (attempt.rawCorrect ?? 0) / (attempt.rawTotal ?? 1),
        0,
      ) / scoredAttempts.length
    : 0;
  const questionCount =
    test?.modules.reduce((sum, module) => sum + module.questions.length, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Your practice"
        title={`Welcome back${student?.displayName ? `, ${student.displayName}` : ""}.`}
        description="Your next assignment is ready. Find a quiet place and use a laptop or tablet."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <Target className="h-5 w-5 text-[var(--blue)]" />
          <p className="mt-4 text-2xl font-black">
            {Math.round(recentAccuracy * 100)}%
          </p>
          <p className="text-sm font-semibold text-slate-500">Recent accuracy</p>
        </Card>
        <Card className="p-5">
          <CheckCircle2 className="h-5 w-5 text-[var(--green)]" />
          <p className="mt-4 text-2xl font-black">
            {
              studentAttempts.filter(
                (attempt) => attempt.status === "submitted",
              ).length
            }
          </p>
          <p className="text-sm font-semibold text-slate-500">
            Assignments completed
          </p>
        </Card>
        <Card className="p-5">
          <BookOpenCheck className="h-5 w-5 text-violet-700" />
          <p className="mt-4 text-2xl font-black">
            {scoredAttempts.length ? "Building" : "Not enough data"}
          </p>
          <p className="text-sm font-semibold text-slate-500">Strongest domain</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b bg-[var(--navy)] px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-blue-100">Next assignment</p>
              <Badge className="bg-white/15 text-white">Open</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-black">
              {assignment?.title ?? "No open assignment"}
            </h2>
            <p className="mt-1 text-sm text-blue-100">{test?.description}</p>
          </div>
          <div className="p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <Clock3 className="h-4 w-4 text-slate-500" />
                <p className="mt-2 font-black">
                  {test?.modules[0]?.durationMinutes ?? 20} min
                </p>
                <p className="text-xs text-slate-500">Time limit</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <BookOpenCheck className="h-4 w-4 text-slate-500" />
                <p className="mt-2 font-black">{questionCount}</p>
                <p className="text-xs text-slate-500">Questions</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <p className="mt-2 font-black">
                  {assignment
                    ? new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                      }).format(new Date(assignment.dueAt))
                    : "—"}
                </p>
                <p className="text-xs text-slate-500">Due date</p>
              </div>
            </div>
            <Link
              href={
                assignment
                  ? `/student/test/${isDemoAssignment() ? "demo" : assignment.id}`
                  : "/student"
              }
              aria-disabled={!assignment}
              className="focus-ring mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] font-bold text-white hover:bg-[var(--navy-dark)]"
            >
              {assignment ? "Start assignment" : "Nothing due"}{" "}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="mt-3 text-center text-xs font-semibold text-slate-400">
              Progress saves automatically. Your tutor sees status, not answers.
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-extrabold">Your next focus</h2>
          <p className="mt-1 text-sm text-slate-500">
            Based on released performance
          </p>
          <div className="mt-5 space-y-4">
            {scoredAttempts.slice(0, 3).map((attempt) => {
              const completedAssignment = state.assignments.find(
                (item) => item.id === attempt.assignmentId,
              );
              const score = Math.round(
                ((attempt.rawCorrect ?? 0) / Math.max(1, attempt.rawTotal ?? 0)) *
                  100,
              );
              return (
              <div key={attempt.id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold">
                    {completedAssignment?.title ?? "SAT practice"}
                  </p>
                  <span className="text-xs font-bold text-slate-500">
                    {score}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-[var(--blue)]"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              );
            })}
            {!scoredAttempts.length && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                Your tutor&apos;s released results and recommendations will
                appear here after your first submission.
              </p>
            )}
          </div>
          <Link
            href="/student/results"
            className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[var(--blue)]"
          >
            View all released results <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </>
  );
}
