import { describe, expect, it } from "vitest";
import type { Question, ResponseRecord, TestDefinition } from "@/lib/domain";
import { makeAcceptedAnswers } from "@/lib/scoring";
import {
  buildScoreSummary,
  duplicatedQuestionIds,
  modulesForWorkType,
  validateTestForAssignment,
} from "@/lib/work-types";

function question(id: string, answer: string, section = "Math"): Question {
  return {
    id,
    sourceId: id,
    versionHash: `${id}-hash`,
    assessment: "SAT",
    section: section as Question["section"],
    domain: "Algebra",
    skill: "Linear equations",
    difficulty: "Medium",
    responseType: "multiple_choice",
    acceptedAnswers: makeAcceptedAnswers([answer]),
    promptAssets: [],
    rationaleAssets: [],
    extractedText: "",
    sourceFileName: "fixture",
    importedAt: "2026-06-09T00:00:00.000Z",
    status: "published",
  };
}

function testWithModules(workType: TestDefinition["workType"]): TestDefinition {
  return {
    id: "test-1",
    title: "Template",
    description: "",
    mode: workType === "custom" ? "practice" : "exam",
    workType,
    status: "draft",
    routingThreshold: 0.6,
    createdAt: "2026-06-09T00:00:00.000Z",
    modules: modulesForWorkType(workType),
  };
}

describe("work type templates", () => {
  it("allows custom work from 1 to 49 questions", () => {
    const test = testWithModules("custom");
    test.modules[0].questions = [{ questionId: "q1", order: 1 }];
    expect(validateTestForAssignment(test)).toMatchObject({ valid: true });

    test.modules[0].questions = Array.from({ length: 50 }, (_, index) => ({
      questionId: `q${index}`,
      order: index + 1,
    }));
    expect(validateTestForAssignment(test).errors[0]).toContain("1-49");
  });

  it("strictly validates SAT-style module counts and durations", () => {
    const test = testWithModules("math_practice");
    expect(validateTestForAssignment(test).valid).toBe(false);

    test.modules[0].questions = Array.from({ length: 22 }, (_, index) => ({
      questionId: `q${index}`,
      order: index + 1,
    }));
    expect(validateTestForAssignment(test)).toMatchObject({ valid: true });

    test.modules[0].durationMinutes = 20;
    expect(validateTestForAssignment(test).errors[0]).toContain("35 minutes");
  });

  it("rejects duplicate question placements across modules", () => {
    const test = testWithModules("math_simulation");
    test.modules[0].questions = [{ questionId: "q1", order: 1 }];
    test.modules[1].questions = [{ questionId: "q1", order: 1 }];

    expect(duplicatedQuestionIds(test)).toEqual(["q1"]);
    expect(validateTestForAssignment(test).errors).toContain(
      "Each question can appear only once in a test.",
    );
  });
});

describe("unofficial score summaries", () => {
  it("builds raw, accuracy, section, and estimated score range", () => {
    const questions = [
      question("rw-1", "A", "Reading and Writing"),
      question("math-1", "B", "Math"),
    ];
    const responses: ResponseRecord[] = [
      {
        questionId: "rw-1",
        value: "A",
        flagged: false,
        eliminatedChoices: [],
        secondsSpent: 10,
        changedCount: 0,
      },
      {
        questionId: "math-1",
        value: "C",
        flagged: true,
        eliminatedChoices: ["A"],
        secondsSpent: 20,
        changedCount: 1,
      },
    ];
    const test: TestDefinition = {
      id: "test-1",
      title: "Full",
      description: "",
      mode: "exam",
      workType: "full_length",
      status: "draft",
      routingThreshold: 0.6,
      createdAt: "2026-06-09T00:00:00.000Z",
      modules: [
        {
          id: "module-rw",
          title: "RW",
          section: "Reading and Writing",
          durationMinutes: 32,
          route: "common",
          order: 1,
          questions: [{ questionId: "rw-1", order: 1 }],
        },
        {
          id: "module-math",
          title: "Math",
          section: "Math",
          durationMinutes: 35,
          route: "common",
          order: 2,
          questions: [{ questionId: "math-1", order: 1 }],
        },
      ],
    };

    expect(buildScoreSummary(test, questions, responses)).toMatchObject({
      rawCorrect: 1,
      rawTotal: 2,
      estimatedScoreRange: [970, 1030],
      sections: [
        { section: "Reading and Writing", estimatedScoreRange: [770, 800] },
        { section: "Math", estimatedScoreRange: [200, 230] },
      ],
    });
  });
});
