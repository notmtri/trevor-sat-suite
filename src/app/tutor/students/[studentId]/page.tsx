"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Ban,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuestionAssetImage } from "@/components/question-asset-image";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Select, Textarea } from "@/components/ui/field";
import {
  getAssignmentRecipients,
  getEffectiveAssignmentWindow,
  getStudentAssignmentCards,
  summarizeStudentProgress,
} from "@/lib/assignment-utils";
import type { Assignment, Attempt, Question, ReleasedReport } from "@/lib/domain";
import { buildAttemptReview, reportForAttempt } from "@/lib/reports";
import { formatDuration, formatRelativeDate } from "@/lib/utils";

function makeTemporaryPassword() {
  return `SAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function orderedQuestionsForAttempt(
  assignment: Assignment | undefined,
  attempt: Attempt,
  state: ReturnType<typeof useAppState>["state"],
) {
  const test = state.tests.find((item) => item.id === assignment?.testId);
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
      state.questions.find((question) => question.id === placement.questionId),
    )
    .filter((question): question is Question => Boolean(question))
    .filter(
      (question) =>
        attempt.responses.some((response) => response.questionId === question.id) ||
        placements.some((placement) => placement.questionId === question.id),
    );
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const { state, updateStudent, updateAssignment, updateAttempt } = useAppState();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const student = state.students.find((item) => item.id === params.studentId);
  const progress = student
    ? summarizeStudentProgress(state, student)
    : undefined;
  const assignmentCards = student
    ? getStudentAssignmentCards(state, student.id)
    : [];

  function allowRetake(assignment: Assignment) {
    if (!student) return;
    const window = getEffectiveAssignmentWindow(assignment, student.id);
    const recipients = getAssignmentRecipients(assignment);
    const nextRecipients = recipients.map((recipient) =>
      recipient.studentId === student.id
        ? {
            ...recipient,
            attemptLimit: window.attemptLimit + 1,
            status: "extended" as const,
          }
        : recipient,
    );
    updateAssignment(assignment.id, { recipients: nextRecipients });
  }

  function releaseAttempt(attempt: Attempt) {
    const existingReport = reportForAttempt(state.releasedReports, attempt.id);
    const report: ReleasedReport = {
      id: existingReport?.id ?? crypto.randomUUID(),
      attemptId: attempt.id,
      summary: {
        tutorComment:
          comments[attempt.id]?.trim() ||
          "Released for review. Bring questions from this report to tutoring.",
      },
      releasedAt: new Date().toISOString(),
    };
    updateAttempt(attempt.id, { released: true }, report);
  }

  if (!student || !progress) {
    return (
      <Card className="p-10 text-center">
        <p className="font-bold">Student not found.</p>
        <Link
          href="/tutor/students"
          className="mt-4 inline-flex text-sm font-bold text-[var(--blue)]"
        >
          Back to students
        </Link>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Student detail"
        title={student.displayName}
        description={`@${student.username} - ${progress.completed} completed attempt${progress.completed === 1 ? "" : "s"}`}
        actions={
          <Link
            href="/tutor/students"
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Students
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-500">Accuracy</p>
          <p className="mt-2 text-3xl font-black">
            {Math.round(progress.accuracy * 100)}%
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-500">Released</p>
          <p className="mt-2 text-3xl font-black">{progress.released.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-500">Status</p>
          <Badge className="mt-3" tone={student.status === "active" ? "green" : "rose"}>
            {student.status}
          </Badge>
        </Card>
        <Card className="p-5">
          <FieldLabel htmlFor="detail-time">Time accommodation</FieldLabel>
          <Select
            id="detail-time"
            value={student.timeMultiplier}
            onChange={(event) =>
              updateStudent(student.id, {
                timeMultiplier: Number(event.target.value) as typeof student.timeMultiplier,
              })
            }
          >
            <option value="1">Standard time</option>
            <option value="1.5">Time and one-half</option>
            <option value="2">Double time</option>
          </Select>
        </Card>
      </div>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-extrabold">Account controls</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage access and password recovery for this student.
          </p>
          {temporaryPassword && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 font-mono text-sm font-bold text-amber-900">
              New temporary password: {temporaryPassword}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<KeyRound className="h-4 w-4" />}
            onClick={() => {
              const password = makeTemporaryPassword();
              setTemporaryPassword(password);
              updateStudent(student.id, {
                temporaryPassword: password,
                mustChangePassword: true,
              });
            }}
          >
            Issue temp password
          </Button>
          <Button
            variant={student.status === "active" ? "danger" : "secondary"}
            icon={<Ban className="h-4 w-4" />}
            onClick={() =>
              updateStudent(student.id, {
                status: student.status === "active" ? "disabled" : "active",
              })
            }
          >
            {student.status === "active" ? "Disable" : "Enable"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-5">
        {assignmentCards.map((card) => {
          const attempts = progress.attempts.filter(
            (attempt) => attempt.assignmentId === card.assignment.id,
          );
          return (
            <Card key={card.assignment.id} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{card.assignment.title}</h2>
                    <Badge tone={card.status === "released" ? "green" : "blue"}>
                      {card.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Due{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                    }).format(new Date(card.effectiveDueAt))}{" "}
                    - {card.attemptsUsed} of {card.effectiveAttemptLimit} attempt
                    {card.effectiveAttemptLimit === 1 ? "" : "s"} used
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw className="h-4 w-4" />}
                  onClick={() => allowRetake(card.assignment)}
                >
                  Allow retake
                </Button>
              </div>

              <div className="divide-y">
                {attempts.map((attempt) => {
                  const assignment = state.assignments.find(
                    (item) => item.id === attempt.assignmentId,
                  );
                  const report = reportForAttempt(
                    state.releasedReports,
                    attempt.id,
                  );
                  const review = buildAttemptReview(
                    attempt,
                    orderedQuestionsForAttempt(assignment, attempt, state),
                    report,
                  );
                  return (
                    <div key={attempt.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={
                                attempt.released
                                  ? "green"
                                  : attempt.status === "submitted"
                                    ? "amber"
                                    : "blue"
                              }
                            >
                              {attempt.released ? "Released" : attempt.status}
                            </Badge>
                            {attempt.submittedAt && (
                              <span className="text-xs font-semibold text-slate-500">
                                Submitted {formatRelativeDate(attempt.submittedAt)}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm font-bold">
                            Score: {attempt.rawCorrect ?? review.correct} /{" "}
                            {attempt.rawTotal ?? review.total}
                          </p>
                          {report?.summary.tutorComment && (
                            <p className="mt-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
                              {report.summary.tutorComment}
                            </p>
                          )}
                        </div>
                        <div className="w-full max-w-md">
                          <FieldLabel htmlFor={`comment-${attempt.id}`}>
                            Tutor comment
                          </FieldLabel>
                          <Textarea
                            id={`comment-${attempt.id}`}
                            rows={2}
                            value={
                              comments[attempt.id] ??
                              report?.summary.tutorComment ??
                              ""
                            }
                            onChange={(event) =>
                              setComments((current) => ({
                                ...current,
                                [attempt.id]: event.target.value,
                              }))
                            }
                            placeholder="What should this student focus on?"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            {attempt.released ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => releaseAttempt(attempt)}
                                >
                                  Save comment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  icon={<LockKeyhole className="h-4 w-4" />}
                                  onClick={() =>
                                    updateAttempt(attempt.id, { released: false })
                                  }
                                >
                                  Unrelease
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                icon={<Send className="h-4 w-4" />}
                                disabled={
                                  !["submitted", "expired"].includes(
                                    attempt.status,
                                  )
                                }
                                onClick={() => releaseAttempt(attempt)}
                              >
                                Release
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {review.questions.map((item, index) => (
                          <div
                            key={item.question.id}
                            className="rounded-xl border bg-slate-50 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-black">
                                Question {index + 1}: {item.question.sourceId}
                              </p>
                              <Badge tone={item.correct ? "green" : "rose"}>
                                {item.correct ? "Correct" : "Incorrect"}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                              <p>
                                <strong>Student:</strong> {item.selectedAnswer}
                              </p>
                              <p>
                                <strong>Correct:</strong> {item.correctAnswer}
                              </p>
                              <p>
                                <strong>Time:</strong>{" "}
                                {formatDuration(item.secondsSpent)}
                                {item.flagged ? " - flagged" : ""}
                              </p>
                            </div>
                            {attempt.released &&
                              item.question.rationaleAssets.length > 0 && (
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-sm font-bold text-[var(--blue)]">
                                    View rationale
                                  </summary>
                                  <div className="mt-3 space-y-3">
                                    {item.question.rationaleAssets.map((asset) => (
                                      <QuestionAssetImage
                                        key={asset.id}
                                        asset={asset}
                                        alt={`Rationale ${item.question.sourceId}`}
                                        className="rounded-lg border bg-white"
                                      />
                                    ))}
                                  </div>
                                </details>
                              )}
                          </div>
                        ))}
                        {!review.questions.length && (
                          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                            No saved response details for this attempt yet.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!attempts.length && (
                  <div className="px-6 py-8 text-center text-sm text-slate-500">
                    No attempts for this assignment yet.
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-slate-500">
        <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />
        Live monitoring still hides answer content. This page shows responses
        only after submission or expiry.
      </div>
    </>
  );
}
