import { describe, expect, it } from "vitest";
import type { AppState, Question } from "@/lib/domain";
import {
  allQuestionTags,
  filterQuestions,
  questionUsage,
} from "@/lib/question-library";
import { defaultTutorSettings } from "@/lib/settings";

const questions: Question[] = [
  {
    id: "q1",
    sourceId: "algebra-1",
    versionHash: "hash-1",
    assessment: "SAT",
    section: "Math",
    domain: "Algebra",
    skill: "Linear equations",
    difficulty: "Easy",
    responseType: "multiple_choice",
    acceptedAnswers: [],
    promptAssets: [],
    rationaleAssets: [],
    extractedText: "linear equation",
    sourceFileName: "fixture.pdf",
    importedAt: "2026-06-08T00:00:00.000Z",
    status: "published",
    tags: ["week-1", "algebra"],
  },
  {
    id: "q2",
    sourceId: "words-1",
    versionHash: "hash-2",
    assessment: "SAT",
    section: "Reading and Writing",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "Hard",
    responseType: "multiple_choice",
    acceptedAnswers: [],
    promptAssets: [],
    rationaleAssets: [],
    extractedText: "context clue",
    sourceFileName: "fixture.pdf",
    importedAt: "2026-06-08T00:00:00.000Z",
    status: "archived",
    tags: ["week-2"],
  },
];

describe("question library helpers", () => {
  it("filters by status and tag", () => {
    expect(
      filterQuestions(questions, {
        search: "",
        section: "all",
        difficulty: "all",
        status: "archived",
        tag: "week-2",
      }).map((question) => question.id),
    ).toEqual(["q2"]);
  });

  it("returns sorted unique tags", () => {
    expect(allQuestionTags(questions)).toEqual(["algebra", "week-1", "week-2"]);
  });

  it("protects questions used in tests or responses", () => {
    const state: AppState = {
      settings: defaultTutorSettings,
      questions,
      students: [],
      tests: [
        {
          id: "test-1",
          title: "Test",
          description: "",
          mode: "practice",
          status: "draft",
          routingThreshold: 0.6,
          createdAt: "2026-06-08T00:00:00.000Z",
          modules: [
            {
              id: "module-1",
              title: "Module",
              section: "Math",
              durationMinutes: 20,
              route: "common",
              order: 1,
              questions: [{ questionId: "q1", order: 1 }],
            },
          ],
        },
      ],
      assignments: [],
      attempts: [],
      releasedReports: [],
    };
    expect(questionUsage(state, "q1")).toMatchObject({
      safeToDelete: false,
      testCount: 1,
    });
  });
});
