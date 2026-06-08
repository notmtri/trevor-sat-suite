"use client";

import { LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuestionAssetImage } from "@/components/question-asset-image";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Assignment, Attempt, Question } from "@/lib/domain";
import { buildAttemptReview, reportForAttempt } from "@/lib/reports";
import { formatDuration } from "@/lib/utils";

function orderedQuestionsForAttempt(
  assignment: Assignment | undefined,
  attempt: Attempt,
  questions: Question[],
  tests: ReturnType<typeof useAppState>["state"]["tests"],
) {
  const test = tests.find((item) => item.id === assignment?.testId);
  const placements =
    test?.modules
      .flatMap((module) =>
        module.questions
          .filter((placement) => !placement.unscored)
          .map((placement) => ({
            ...placement,
            moduleOrder: module.order,
          })),
      )
      .sort(
        (a, b) => a.moduleOrder - b.moduleOrder || a.order - b.order,
      ) ?? [];
  return placements
    .map((placement) =>
      questions.find((question) => question.id === placement.questionId),
    )
    .filter((question): question is Question => Boolean(question))
    .filter(
      (question) =>
        attempt.responses.some((response) => response.questionId === question.id) ||
        placements.some((placement) => placement.questionId === question.id),
    );
}

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
          const report = reportForAttempt(state.releasedReports, attempt.id);
          const review = buildAttemptReview(
            attempt,
            orderedQuestionsForAttempt(
              assignment,
              attempt,
              state.questions,
              state.tests,
            ),
            report,
          );
          const accuracy = review.accuracy;
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
                    {attempt.rawCorrect ?? review.correct} /{" "}
                    {attempt.rawTotal ?? review.total}
                  </p>
                </div>
              </div>
              {report?.summary.tutorComment && (
                <div className="border-t bg-blue-50 px-6 py-4 text-sm font-semibold text-blue-900">
                  Tutor note: {report.summary.tutorComment}
                </div>
              )}
              <div className="divide-y border-t">
                {review.questions.map((item, index) => (
                  <div key={item.question.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black">
                          Question {index + 1}: {item.question.sourceId}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.question.domain} - {item.question.skill}
                        </p>
                      </div>
                      <Badge tone={item.correct ? "green" : "rose"}>
                        {item.correct ? "Correct" : "Review"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                      <p>
                        <strong>Your answer:</strong> {item.selectedAnswer}
                      </p>
                      <p>
                        <strong>Correct answer:</strong> {item.correctAnswer}
                      </p>
                      <p>
                        <strong>Time:</strong> {formatDuration(item.secondsSpent)}
                        {item.flagged ? " - flagged" : ""}
                      </p>
                    </div>
                    {item.question.rationaleAssets.length > 0 && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-bold text-[var(--blue)]">
                          View rationale
                        </summary>
                        <div className="mt-3 space-y-3">
                          {item.question.rationaleAssets.map((asset) => (
                            <QuestionAssetImage
                              key={asset.id}
                              asset={asset}
                              alt={`Rationale ${item.question.sourceId}`}
                              className="rounded-xl border bg-white"
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
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
