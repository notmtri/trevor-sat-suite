import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/domain";
import {
  estimateSatScore,
  isResponseCorrect,
  makeAcceptedAnswers,
  normalizeSprAnswer,
} from "@/lib/scoring";

function question(
  responseType: Question["responseType"],
  answers: string[],
): Question {
  return {
    id: "q1",
    sourceId: "source",
    versionHash: "hash",
    assessment: "SAT",
    section: "Math",
    domain: "Algebra",
    skill: "Linear equations",
    difficulty: "Medium",
    responseType,
    acceptedAnswers: makeAcceptedAnswers(answers),
    promptAssets: [],
    rationaleAssets: [],
    extractedText: "",
    sourceFileName: "fixture.pdf",
    importedAt: "2026-06-06T00:00:00.000Z",
    status: "published",
  };
}

describe("SPR normalization", () => {
  it("normalizes harmless decimal and fraction formatting", () => {
    expect(normalizeSprAnswer(".1764")).toBe("0.1764");
    expect(normalizeSprAnswer("0.176400")).toBe("0.1764");
    expect(normalizeSprAnswer(" 3 / 17 ")).toBe("3/17");
  });

  it("accepts every explicitly listed form", () => {
    const item = question("student_produced", [".1764", ".1765", "3/17"]);
    expect(isResponseCorrect(item, "0.176400")).toBe(true);
    expect(isResponseCorrect(item, " 3 / 17 ")).toBe(true);
    expect(isResponseCorrect(item, ".1765")).toBe(true);
  });

  it("does not infer an unlisted equivalent answer", () => {
    const item = question("student_produced", ["3/17"]);
    expect(isResponseCorrect(item, ".17647")).toBe(false);
  });
});

describe("versioned SAT score ranges", () => {
  it("uses explicit conversion ranges and refuses missing raw scores", () => {
    const model = {
      id: "model",
      name: "Practice Test",
      version: "1",
      sourceUrl: "https://example.com/official-guide.pdf",
      readingWriting: [{ raw: 50, lower: 700, upper: 720 }],
      math: [{ raw: 40, lower: 680, upper: 710 }],
    };
    expect(estimateSatScore(50, 40, model)).toMatchObject({
      total: 1410,
      range: [1380, 1430],
    });
    expect(estimateSatScore(49, 40, model)).toBeNull();
  });
});

describe("multiple-choice scoring", () => {
  it("scores answer letters without case sensitivity", () => {
    const item = question("multiple_choice", ["D"]);
    expect(isResponseCorrect(item, "d")).toBe(true);
    expect(isResponseCorrect(item, "C")).toBe(false);
  });
});
