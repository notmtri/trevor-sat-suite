import type { AppState, Question, QuestionStatus } from "@/lib/domain";

export type QuestionLibraryFilters = {
  search: string;
  section: string;
  difficulty: string;
  status: string;
  tag: string;
};

export function filterQuestions(
  questions: Question[],
  filters: QuestionLibraryFilters,
) {
  const search = filters.search.trim().toLowerCase();
  return questions.filter((question) => {
    const tags = question.tags ?? [];
    const haystack = [
      question.sourceId,
      question.domain,
      question.skill,
      question.extractedText,
      tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (filters.section === "all" || question.section === filters.section) &&
      (filters.difficulty === "all" ||
        question.difficulty === filters.difficulty) &&
      (filters.status === "all" || question.status === filters.status) &&
      (filters.tag === "all" || tags.includes(filters.tag))
    );
  });
}

export function allQuestionTags(questions: Question[]) {
  return [...new Set(questions.flatMap((question) => question.tags ?? []))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function questionUsage(state: AppState, questionId: string) {
  const testCount = state.tests.filter((test) =>
    test.modules.some((module) =>
      module.questions.some((question) => question.questionId === questionId),
    ),
  ).length;
  const responseCount = state.attempts.filter((attempt) =>
    attempt.responses.some((response) => response.questionId === questionId),
  ).length;
  return {
    testCount,
    responseCount,
    safeToDelete: testCount === 0 && responseCount === 0,
  };
}

export function bulkQuestionChanges(
  status: QuestionStatus,
): Pick<Question, "status"> {
  return { status };
}
