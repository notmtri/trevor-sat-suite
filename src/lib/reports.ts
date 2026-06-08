import type {
  Assignment,
  Attempt,
  Question,
  ReleasedReport,
  ResponseRecord,
} from "@/lib/domain";
import { isResponseCorrect } from "@/lib/scoring";

export type ReviewQuestion = {
  question: Question;
  response?: ResponseRecord;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
  flagged: boolean;
  secondsSpent: number;
};

export type AttemptReview = {
  attempt: Attempt;
  report?: ReleasedReport;
  questions: ReviewQuestion[];
  correct: number;
  total: number;
  accuracy: number;
};

export function canViewFullReview(
  assignment: Assignment | undefined,
  attempt: Attempt | undefined,
) {
  if (!assignment || !attempt) return false;
  if (!["submitted", "expired"].includes(attempt.status)) return false;
  return attempt.released || assignment.feedbackPolicy !== "tutor_release";
}

export function buildAttemptReview(
  attempt: Attempt,
  questions: Question[],
  report?: ReleasedReport,
): AttemptReview {
  const responseMap = new Map(
    attempt.responses.map((response) => [response.questionId, response]),
  );
  const reviewQuestions = questions.map((question) => {
    const response = responseMap.get(question.id);
    const correct = response ? isResponseCorrect(question, response.value) : false;
    return {
      question,
      response,
      selectedAnswer: response?.value.trim() || "No answer",
      correctAnswer:
        question.acceptedAnswers.map((answer) => answer.value).join(", ") ||
        "Not configured",
      correct,
      flagged: Boolean(response?.flagged),
      secondsSpent: response?.secondsSpent ?? 0,
    };
  });
  const total = reviewQuestions.length;
  const correct = reviewQuestions.filter((item) => item.correct).length;
  return {
    attempt,
    report,
    questions: reviewQuestions,
    correct,
    total,
    accuracy: total ? correct / total : 0,
  };
}

export function questionsForAttempt(
  assignment: Assignment | undefined,
  testQuestions: Array<{ questionId: string; unscored?: boolean }>,
  questions: Question[],
) {
  if (!assignment) return [];
  return testQuestions
    .filter((placement) => !placement.unscored)
    .map((placement) =>
      questions.find((question) => question.id === placement.questionId),
    )
    .filter((question): question is Question => Boolean(question));
}

export function reportForAttempt(
  reports: ReleasedReport[],
  attemptId: string,
) {
  return reports.find((report) => report.attemptId === attemptId);
}
