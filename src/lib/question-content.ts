import type {
  ChoiceLabel,
  Question,
  QuestionChoice,
  QuestionContent,
  ResponseType,
  Section,
} from "@/lib/domain";

export const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

function cleanText(value: unknown, maxLength = 20_000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function normalizeQuestionContent(value: unknown): QuestionContent {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const choices = Array.isArray(input.choices)
    ? input.choices.flatMap((choice): QuestionChoice[] => {
        if (!choice || typeof choice !== "object") return [];
        const raw = choice as Record<string, unknown>;
        const label = raw.label;
        if (
          label !== "A" &&
          label !== "B" &&
          label !== "C" &&
          label !== "D"
        ) {
          return [];
        }
        return [{ label, text: cleanText(raw.text, 5_000) }];
      })
    : [];
  return {
    passage: cleanText(input.passage),
    stem: cleanText(input.stem),
    choices,
  };
}

export function compactQuestionContent(content?: QuestionContent) {
  const normalized = normalizeQuestionContent(content);
  return {
    ...(normalized.passage ? { passage: normalized.passage } : {}),
    ...(normalized.stem ? { stem: normalized.stem } : {}),
    ...(normalized.choices?.length
      ? {
          choices: normalized.choices.map((choice) => ({
            label: choice.label,
            text: choice.text,
          })),
        }
      : {}),
  } satisfies QuestionContent;
}

export function questionHasTypedContent(question: Question) {
  const content = normalizeQuestionContent(question.content);
  return Boolean(
    content.passage ||
      content.stem ||
      content.choices?.some((choice) => choice.text),
  );
}

export function choiceTextForLabel(
  question: Pick<Question, "content">,
  label: string,
) {
  const content = normalizeQuestionContent(question.content);
  return (
    content.choices?.find((choice) => choice.label === label)?.text.trim() ?? ""
  );
}

export function formatChoiceLabel(
  question: Pick<Question, "content">,
  label: string,
) {
  const text = choiceTextForLabel(question, label);
  return text ? `${label}. ${text}` : `Choice ${label}`;
}

export function formatResponseForReview(
  question: Pick<Question, "content" | "responseType">,
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return "No answer";
  if (question.responseType !== "multiple_choice") return trimmed;
  return formatChoiceLabel(question, trimmed.toUpperCase());
}

export function formatCorrectAnswerForReview(question: Question) {
  if (!question.acceptedAnswers.length) return "Not configured";
  return question.acceptedAnswers
    .map((answer) =>
      question.responseType === "multiple_choice"
        ? formatChoiceLabel(question, answer.value.toUpperCase())
        : answer.value,
    )
    .join(", ");
}

export function questionSearchText(question: Question) {
  const content = normalizeQuestionContent(question.content);
  return [
    question.sourceId,
    question.domain,
    question.skill,
    question.extractedText,
    content.passage,
    content.stem,
    ...(content.choices?.map((choice) => choice.text) ?? []),
    ...(question.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

export function questionPreviewText(question: Question, fallback = "Image question") {
  const content = normalizeQuestionContent(question.content);
  const text = [content.stem, content.passage]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || question.extractedText.trim() || fallback;
}

export function validateQuestionContent({
  section,
  responseType,
  content,
}: {
  section: Section;
  responseType: ResponseType;
  content?: QuestionContent;
}) {
  const errors: string[] = [];
  const normalized = normalizeQuestionContent(content);
  if (section === "Reading and Writing") {
    if (responseType !== "multiple_choice") {
      errors.push("Reading and Writing questions must be multiple choice.");
    }
    if (!normalized.stem) {
      errors.push("Add the verbal question stem.");
    }
    for (const label of CHOICE_LABELS) {
      if (!choiceTextForLabel({ content: normalized }, label)) {
        errors.push(`Add answer choice ${label}.`);
      }
    }
  }
  return errors;
}
