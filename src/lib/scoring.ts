import type { AcceptedAnswer, Question, ResponseRecord } from "@/lib/domain";

function normalizeDecimal(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toString();
}

export function normalizeSprAnswer(value: string) {
  const compact = value.trim().replace(/\s+/g, "");
  if (!compact) return "";

  const fraction = compact.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (fraction) {
    const numerator = normalizeDecimal(fraction[1]);
    const denominator = normalizeDecimal(fraction[2]);
    if (numerator !== null && denominator !== null) {
      return `${numerator}/${denominator}`;
    }
  }

  return normalizeDecimal(compact) ?? compact.toLowerCase();
}

export function makeAcceptedAnswers(values: string[]): AcceptedAnswer[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => ({
      id: `answer-${index}-${value}`,
      value,
      normalizedValue: normalizeSprAnswer(value),
    }));
}

export function isResponseCorrect(question: Question, value: string) {
  if (question.responseType === "multiple_choice") {
    return question.acceptedAnswers.some(
      (answer) => answer.value.toUpperCase() === value.trim().toUpperCase(),
    );
  }

  const normalized = normalizeSprAnswer(value);
  return question.acceptedAnswers.some(
    (answer) => answer.normalizedValue === normalized,
  );
}

export function scoreResponses(
  questions: Question[],
  responses: ResponseRecord[],
) {
  const responseMap = new Map(
    responses.map((response) => [response.questionId, response.value]),
  );
  const correct = questions.filter((question) =>
    isResponseCorrect(question, responseMap.get(question.id) ?? ""),
  ).length;
  return {
    correct,
    total: questions.length,
    accuracy: questions.length ? correct / questions.length : 0,
  };
}

export type ScoreRange = {
  raw: number;
  lower: number;
  upper: number;
};

export type ScoreConversionModel = {
  id: string;
  name: string;
  version: string;
  sourceUrl: string;
  readingWriting: ScoreRange[];
  math: ScoreRange[];
};

function findScoreRange(ranges: ScoreRange[], raw: number) {
  return ranges.find((range) => range.raw === raw) ?? null;
}

export function estimateSatScore(
  readingWritingRaw: number,
  mathRaw: number,
  model: ScoreConversionModel,
) {
  const readingWriting = findScoreRange(
    model.readingWriting,
    readingWritingRaw,
  );
  const math = findScoreRange(model.math, mathRaw);
  if (!readingWriting || !math) return null;
  const lower = readingWriting.lower + math.lower;
  const upper = readingWriting.upper + math.upper;
  return {
    readingWriting: {
      range: [readingWriting.lower, readingWriting.upper] as [number, number],
      midpoint: Math.round((readingWriting.lower + readingWriting.upper) / 20) * 10,
    },
    math: {
      range: [math.lower, math.upper] as [number, number],
      midpoint: Math.round((math.lower + math.upper) / 20) * 10,
    },
    total: Math.round((lower + upper) / 20) * 10,
    range: [lower, upper] as [number, number],
    label: `Unofficial estimate · ${model.name} ${model.version}`,
    sourceUrl: model.sourceUrl,
  };
}
