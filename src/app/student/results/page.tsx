"use client";

import { PageHeader } from "@/components/page-header";
import { QuestionContentView } from "@/components/question-content-view";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getStudentResultAttempts } from "@/lib/assignment-utils";
import type { Assignment, Attempt, Question } from "@/lib/domain";
import { buildAttemptReview } from "@/lib/reports";

function orderedQuestionsForAttempt(
  assignment: Assignment | undefined,
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
    .filter((question): question is Question => Boolean(question));
}

export default function StudentResultsPage() {
  const { state } = useAppState();
  const { released: results } = getStudentResultAttempts(state);

  return (
    <>
      <PageHeader
        eyebrow="Scores"
        title="My results"
        description="See how many answers you got right and review every correction."
      />
      <div className="space-y-4">
        {results.map((attempt: Attempt) => {
          const assignment = state.assignments.find(
            (item) => item.id === attempt.assignmentId,
          );
          const questions = orderedQuestionsForAttempt(
            assignment,
            state.questions,
            state.tests,
          );
          const review = buildAttemptReview(attempt, questions);
          const correct = attempt.rawCorrect ?? review.correct;
          const total = attempt.rawTotal ?? review.total;

          return (
            <Card key={attempt.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                <div>
                  <h2 className="font-black">
                    {assignment?.title ?? "SAT practice"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {attempt.submittedAt
                      ? new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                        }).format(new Date(attempt.submittedAt))
                      : "Completed"}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-5 py-3 text-center text-emerald-800">
                  <p className="text-2xl font-black">
                    {correct} / {total}
                  </p>
                  <p className="text-xs font-bold">Correct</p>
                </div>
              </div>

              <div className="divide-y border-t">
                {review.questions.map((item, index) => (
                  <div key={item.question.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black">Question {index + 1}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.question.domain} - {item.question.skill}
                        </p>
                      </div>
                      <Badge tone={item.correct ? "green" : "rose"}>
                        {item.correct ? "Correct" : "Incorrect"}
                      </Badge>
                    </div>

                    <QuestionContentView
                      question={item.question}
                      imageAlt={`Question ${index + 1}`}
                      showChoices
                      className="mt-4"
                    />

                    <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
                      <p>
                        <strong>Your answer:</strong> {item.selectedAnswer}
                      </p>
                      <p>
                        <strong>Correct answer:</strong> {item.correctAnswer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {!results.length && (
          <Card className="p-10 text-center text-sm text-slate-500">
            No completed tests yet.
          </Card>
        )}
      </div>
    </>
  );
}
