"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getStudentAssignmentCards } from "@/lib/assignment-utils";
import { isDemoMode } from "@/lib/supabase/client";

function assignmentHref(assignmentId: string) {
  return `/student/test/${isDemoMode() ? "demo" : assignmentId}`;
}

export default function StudentDashboard() {
  const { state } = useAppState();
  const student = state.students[0];
  const assignmentCards = student
    ? getStudentAssignmentCards(state, student.id)
    : [];
  const nextCard =
    assignmentCards.find((card) =>
      ["in_progress", "open", "due_soon", "retake_available"].includes(
        card.status,
      ),
    ) ?? assignmentCards[0];
  const assignment = nextCard?.assignment;
  const test = state.tests.find((item) => item.id === assignment?.testId);
  const activeAttempt = state.attempts.find(
    (attempt) =>
      attempt.studentId === student?.id &&
      attempt.assignmentId === assignment?.id &&
      attempt.status === "in_progress",
  );
  const questionCount =
    test?.modules.reduce((sum, module) => sum + module.questions.length, 0) ?? 0;
  const timeLabel = test?.modules.some(
    (module) => module.durationMinutes === null,
  )
    ? "Unlimited"
    : `${test?.modules.reduce(
        (sum, module) => sum + (module.durationMinutes ?? 0),
        0,
      ) ?? 0} min`;

  return (
    <>
      <PageHeader
        eyebrow="Assignments"
        title={`Welcome${student?.displayName ? `, ${student.displayName}` : ""}.`}
        description="Complete your assigned tests and review your answers after submission."
      />

      <Card className="overflow-hidden">
        <div className="border-b bg-[var(--navy)] px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-blue-100">Next assignment</p>
            <Badge className="bg-white/15 text-white">
              {nextCard?.label ?? "None"}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-black">
            {assignment?.title ?? "No open assignment"}
          </h2>
          {test?.description && (
            <p className="mt-1 text-sm text-blue-100">{test.description}</p>
          )}
        </div>
        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <Clock3 className="h-4 w-4 text-slate-500" />
              <p className="mt-2 font-black">{assignment ? timeLabel : "-"}</p>
              <p className="text-xs text-slate-500">Time</p>
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
                    }).format(new Date(nextCard?.effectiveDueAt ?? assignment.dueAt))
                  : "-"}
              </p>
              <p className="text-xs text-slate-500">Due</p>
            </div>
          </div>
          {assignment ? (
            <Link
              href={assignmentHref(assignment.id)}
              className="focus-ring mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] font-bold text-white hover:bg-[var(--navy-dark)]"
            >
              {activeAttempt ? "Resume test" : "Start test"}
              <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <div className="mt-6 flex h-12 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-500">
              No test assigned
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b px-6 py-5">
          <h2 className="font-extrabold">All assignments</h2>
        </div>
        <div className="divide-y">
          {assignmentCards.map((card) => {
            const canStart = [
              "open",
              "due_soon",
              "in_progress",
              "retake_available",
            ].includes(card.status);
            return (
              <div
                key={card.assignment.id}
                className="grid gap-4 px-6 py-4 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-bold">{card.assignment.title}</p>
                  <Badge className="mt-2" tone={canStart ? "blue" : "green"}>
                    {card.label}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  Due{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(card.effectiveDueAt))}
                </p>
                <Link
                  href={
                    canStart
                      ? assignmentHref(card.assignment.id)
                      : "/student/results"
                  }
                  className="text-sm font-bold text-[var(--blue)]"
                >
                  {canStart
                    ? card.status === "in_progress"
                      ? "Resume"
                      : "Start"
                    : "View result"}
                </Link>
              </div>
            );
          })}
          {!assignmentCards.length && (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No assignments yet.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
