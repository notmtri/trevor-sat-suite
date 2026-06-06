"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileUp,
  Plus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAppState } from "@/components/providers/app-state-provider";
import { formatDuration, formatRelativeDate } from "@/lib/utils";

export default function TutorDashboard() {
  const { state } = useAppState();
  const activeStudents = state.students.filter(
    (student) => student.status === "active",
  ).length;
  const publishedQuestions = state.questions.filter(
    (question) => question.status === "published",
  ).length;
  const liveAttempts = state.attempts.filter(
    (attempt) => attempt.status === "in_progress",
  );
  const completedAttempts = state.attempts.filter(
    (attempt) => attempt.status === "submitted",
  );
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={today}
        title="Good afternoon, Trevor."
        description="Your students, assignments, and live sessions are all in one place."
        actions={
          <>
            <Link
              href="/tutor/import"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold hover:bg-slate-50"
            >
              <FileUp className="h-4 w-4" /> Import PDF
            </Link>
            <Link
              href="/tutor/tests"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--navy)] px-4 text-sm font-bold text-white hover:bg-[var(--navy-dark)]"
            >
              <Plus className="h-4 w-4" /> Build a test
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Active students",
            value: activeStudents,
            detail: `${state.students.length} total accounts`,
            icon: Users,
            tone: "bg-blue-50 text-blue-700",
          },
          {
            label: "Published questions",
            value: publishedQuestions,
            detail: `${state.questions.filter((question) => question.status === "draft").length} awaiting review`,
            icon: BookOpenCheck,
            tone: "bg-violet-50 text-violet-700",
          },
          {
            label: "Live now",
            value: liveAttempts.length,
            detail: liveAttempts.length ? "Session heartbeat healthy" : "No active sessions",
            icon: Activity,
            tone: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Completed",
            value: completedAttempts.length,
            detail: "Across open assignments",
            icon: CheckCircle2,
            tone: "bg-amber-50 text-amber-700",
          },
        ].map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black text-[var(--navy-dark)]">
                  {value}
                </p>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">{detail}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-5">
            <div>
              <h2 className="font-extrabold">Live sessions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Progress only; answer content remains hidden.
              </p>
            </div>
            <Link
              href="/tutor/monitor"
              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--blue)]"
            >
              Open monitor <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {liveAttempts.length ? (
            <div className="divide-y">
              {liveAttempts.map((attempt) => {
                const student = state.students.find(
                  (item) => item.id === attempt.studentId,
                );
                const assignment = state.assignments.find(
                  (item) => item.id === attempt.assignmentId,
                );
                return (
                  <div
                    key={attempt.id}
                    className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--mint)] text-sm font-black text-[var(--green)]">
                        {student?.displayName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold">{student?.displayName}</p>
                        <p className="text-sm text-slate-500">
                          {assignment?.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <Clock3 className="h-4 w-4" />
                      {formatDuration(attempt.remainingSeconds ?? 0)}
                    </div>
                    <Badge tone="green">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" />
                      Online
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              No students are testing right now.
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-extrabold">Recent student activity</h2>
          <div className="mt-5 space-y-5">
            {state.students.slice(0, 4).map((student) => (
              <div key={student.id} className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                  {student.displayName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {student.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {student.assignmentsCompleted} assignments completed
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {student.lastActiveAt
                    ? formatRelativeDate(student.lastActiveAt)
                    : "New"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
