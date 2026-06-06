import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createQuestionSpans,
  readQuestionBankStructure,
} from "@/lib/pdf/question-bank-parser";

const fixturePath = fileURLToPath(
  new URL("./fixtures/questionbank-export-2026-6-6.pdf", import.meta.url),
);

describe("Question Bank PDF parser", () => {
  it(
    "assembles seven questions from the canonical eight-page export",
    async () => {
      const buffer = await readFile(fixturePath);
      const pages = await readQuestionBankStructure(
        new Uint8Array(buffer).buffer,
      );
      const spans = createQuestionSpans(pages);

      expect(pages).toHaveLength(8);
      expect(spans).toHaveLength(7);
      expect(spans.map((span) => span.sourceId)).toEqual([
        "ac472881",
        "3f5a3602",
        "3d1070c9",
        "002dba45",
        "edc1b7b7",
        "f224df07",
        "fa80893a",
      ]);
    },
    30_000,
  );

  it(
    "keeps page three as a continuation of question 3f5a3602 rationale",
    async () => {
      const buffer = await readFile(fixturePath);
      const pages = await readQuestionBankStructure(
        new Uint8Array(buffer).buffer,
      );
      const spans = createQuestionSpans(pages);
      const graphQuestion = spans.find(
        (span) => span.sourceId === "3f5a3602",
      );

      expect(graphQuestion).toBeDefined();
      expect(graphQuestion?.startPageIndex).toBe(1);
      expect(graphQuestion?.endPageIndex).toBe(3);
      expect(graphQuestion?.rationaleSegments.map((item) => item.pageIndex)).toEqual([
        1,
        2,
      ]);
      expect(pages[2].questionId).toBeUndefined();
    },
    30_000,
  );

  it(
    "extracts canonical answer keys and response types",
    async () => {
      const buffer = await readFile(fixturePath);
      const pages = await readQuestionBankStructure(
        new Uint8Array(buffer).buffer,
      );
      const spans = createQuestionSpans(pages);

      expect(spans.map((span) => span.answerText)).toEqual([
        "403",
        "D",
        "C",
        ".1764, .1765, 3/17",
        "3",
        "C",
        "17",
      ]);
      expect(spans.map((span) => span.responseType)).toEqual([
        "student_produced",
        "multiple_choice",
        "multiple_choice",
        "student_produced",
        "student_produced",
        "multiple_choice",
        "student_produced",
      ]);
      expect(spans.every((span) => span.warnings.length === 0)).toBe(true);
      expect(spans[0]).toMatchObject({
        assessment: "SAT",
        section: "Math",
        domain: "Algebra",
        skill: "Linear equations in one variable",
        difficulty: "Hard",
      });
    },
    30_000,
  );
});
