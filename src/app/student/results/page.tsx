"use client";

import { LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function StudentResultsPage() {
  const { state } = useAppState();
  const released = state.attempts.filter(
    (attempt) => attempt.released && attempt.rawTotal,
  );
  const unreleased = state.attempts.filter(
    (attempt) =>
      !attempt.released &&
      (attempt.status === "submitted" || attempt.status === "expired"),
  );

  return (
    <>
      <PageHeader
        eyebrow="Released reports"
        title="My results"
        description="Only results released by your tutor appear here."
      />
      <div className="space-y-4">
        {released.map((attempt) => {
          const assignment = state.assignments.find(
            (item) => item.id === attempt.assignmentId,
          );
          const accuracy =
            (attempt.rawCorrect ?? 0) / Math.max(1, attempt.rawTotal ?? 0);
          return (
            <Card key={attempt.id} className="overflow-hidden">
              <div className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black">
                      {assignment?.title ?? "SAT practice"}
                    </h2>
                    <Badge tone="green">Released</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Submitted{" "}
                    {attempt.submittedAt
                      ? new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                        }).format(new Date(attempt.submittedAt))
                      : "recently"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Accuracy
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {Math.round(accuracy * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Correct
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {attempt.rawCorrect} / {attempt.rawTotal}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
        {unreleased.map((attempt) => {
          const assignment = state.assignments.find(
            (item) => item.id === attempt.assignmentId,
          );
          return (
            <Card key={attempt.id} className="flex items-center gap-4 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold">
                  {assignment?.title ?? "SAT practice"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Results have not been released by your tutor.
                </p>
              </div>
            </Card>
          );
        })}
        {!released.length && !unreleased.length && (
          <Card className="p-10 text-center text-sm text-slate-500">
            No submitted assignments yet.
          </Card>
        )}
      </div>
    </>
  );
}
