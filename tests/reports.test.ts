import { describe, expect, it } from "vitest";
import type { Assignment, Attempt, Question } from "@/lib/domain";
import { buildAttemptReview, canViewFullReview } from "@/lib/reports";
import { makeAcceptedAnswers } from "@/lib/scoring";

const assignment: Assignment = {
  id: "assignment-1",
  testId: "test-1",
  studentIds: ["student-1"],
  title: "Review Set",
  availableAt: "2026-06-08T00:00:00.000Z",
  dueAt: "2026-06-15T00:00:00.000Z",
  attemptLimit: 1,
  feedbackPolicy: "tutor_release",
  allowResume: true,
  status: "open",
};

const question: Question = {
  id: "question-1",
  sourceId: "q1",
  versionHash: "hash",
  assessment: "SAT",
  section: "Math",
  domain: "Algebra",
  skill: "Linear equations",
  difficulty: "Medium",
  responseType: "multiple_choice",
  acceptedAnswers: makeAcceptedAnswers(["C"]),
  promptAssets: [],
  rationaleAssets: [],
  extractedText: "",
  sourceFileName: "fixture.pdf",
  importedAt: "2026-06-08T00:00:00.000Z",
  status: "published",
};

const attempt: Attempt = {
  id: "attempt-1",
  assignmentId: assignment.id,
  studentId: "student-1",
  status: "submitted",
  currentQuestionIndex: 0,
  answeredCount: 1,
  connectionStatus: "online",
  responses: [
    {
      questionId: question.id,
      value: "C",
      flagged: true,
      eliminatedChoices: ["A"],
      secondsSpent: 42,
      changedCount: 1,
    },
  ],
  rawCorrect: 1,
  rawTotal: 1,
  released: true,
};

describe("released report helpers", () => {
  it("allows full review only after release for tutor-release assignments", () => {
    expect(canViewFullReview(assignment, { ...attempt, released: false })).toBe(
      false,
    );
    expect(canViewFullReview(assignment, attempt)).toBe(true);
  });

  it("builds question-level review with answers, flags, and timing", () => {
    expect(buildAttemptReview(attempt, [question])).toMatchObject({
      correct: 1,
      total: 1,
      questions: [
        {
          selectedAnswer: "C",
          correctAnswer: "C",
          correct: true,
          flagged: true,
          secondsSpent: 42,
        },
      ],
    });
  });
});
