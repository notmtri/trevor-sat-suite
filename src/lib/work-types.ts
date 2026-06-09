import type {
  Question,
  ResponseRecord,
  ScoreSectionSummary,
  ScoreSummary,
  Section,
  TestDefinition,
  TestModule,
  WorkType,
} from "@/lib/domain";
import { isResponseCorrect } from "@/lib/scoring";

export type WorkTypeModuleTemplate = {
  title: string;
  section: Section;
  questionCount: number;
  durationMinutes: number;
};

export type WorkTypeConfig = {
  label: string;
  description: string;
  mode: TestDefinition["mode"];
  strict: boolean;
  modules: WorkTypeModuleTemplate[];
};

export const WORK_TYPE_CONFIGS: Record<WorkType, WorkTypeConfig> = {
  custom: {
    label: "Custom practice",
    description: "Small targeted practice under 50 questions with adjustable time.",
    mode: "practice",
    strict: false,
    modules: [
      {
        title: "Custom Module",
        section: "Math",
        questionCount: 1,
        durationMinutes: 20,
      },
    ],
  },
  full_length: {
    label: "Full-length SAT",
    description: "Four fixed modules with a timed break before Math.",
    mode: "exam",
    strict: true,
    modules: [
      {
        title: "Reading and Writing Module 1",
        section: "Reading and Writing",
        questionCount: 27,
        durationMinutes: 32,
      },
      {
        title: "Reading and Writing Module 2",
        section: "Reading and Writing",
        questionCount: 27,
        durationMinutes: 32,
      },
      {
        title: "Math Module 1",
        section: "Math",
        questionCount: 22,
        durationMinutes: 35,
      },
      {
        title: "Math Module 2",
        section: "Math",
        questionCount: 22,
        durationMinutes: 35,
      },
    ],
  },
  verbal_simulation: {
    label: "Verbal simulation",
    description: "Two Reading and Writing modules, 27 questions each.",
    mode: "exam",
    strict: true,
    modules: [
      {
        title: "Reading and Writing Module 1",
        section: "Reading and Writing",
        questionCount: 27,
        durationMinutes: 32,
      },
      {
        title: "Reading and Writing Module 2",
        section: "Reading and Writing",
        questionCount: 27,
        durationMinutes: 32,
      },
    ],
  },
  math_simulation: {
    label: "Math simulation",
    description: "Two Math modules, 22 questions each.",
    mode: "exam",
    strict: true,
    modules: [
      {
        title: "Math Module 1",
        section: "Math",
        questionCount: 22,
        durationMinutes: 35,
      },
      {
        title: "Math Module 2",
        section: "Math",
        questionCount: 22,
        durationMinutes: 35,
      },
    ],
  },
  verbal_practice: {
    label: "Verbal practice",
    description: "One Reading and Writing module, 27 questions.",
    mode: "practice",
    strict: true,
    modules: [
      {
        title: "Reading and Writing Practice",
        section: "Reading and Writing",
        questionCount: 27,
        durationMinutes: 32,
      },
    ],
  },
  math_practice: {
    label: "Math practice",
    description: "One Math module, 22 questions.",
    mode: "practice",
    strict: true,
    modules: [
      {
        title: "Math Practice",
        section: "Math",
        questionCount: 22,
        durationMinutes: 35,
      },
    ],
  },
};

export const WORK_TYPES = Object.keys(WORK_TYPE_CONFIGS) as WorkType[];

export function workTypeLabel(workType: WorkType) {
  return WORK_TYPE_CONFIGS[workType].label;
}

export function modulesForWorkType(workType: WorkType): TestModule[] {
  return WORK_TYPE_CONFIGS[workType].modules.map((module, index) => ({
    id: crypto.randomUUID(),
    title: module.title,
    section: module.section,
    durationMinutes: module.durationMinutes,
    route: "common",
    order: index + 1,
    questions: [],
  }));
}

export function questionCountForTest(test: Pick<TestDefinition, "modules">) {
  return test.modules.reduce((sum, module) => sum + module.questions.length, 0);
}

export function validateTestForAssignment(test: TestDefinition) {
  const config = WORK_TYPE_CONFIGS[test.workType];
  const errors: string[] = [];
  const commonModules = test.modules
    .filter((module) => module.route === "common")
    .sort((a, b) => a.order - b.order);

  if (test.workType === "custom") {
    const count = questionCountForTest(test);
    if (count < 1 || count >= 50) {
      errors.push("Custom work must contain 1-49 questions.");
    }
    if (!commonModules.length) {
      errors.push("Custom work needs at least one module.");
    }
    if (commonModules.some((module) => module.durationMinutes < 1)) {
      errors.push("Each custom module needs a positive time limit.");
    }
    return { valid: errors.length === 0, errors };
  }

  if (commonModules.length !== config.modules.length) {
    errors.push(`${config.label} needs ${config.modules.length} module(s).`);
  }

  config.modules.forEach((expected, index) => {
    const testModule = commonModules[index];
    if (!testModule) return;
    if (testModule.section !== expected.section) {
      errors.push(`${expected.title} must be ${expected.section}.`);
    }
    if (testModule.durationMinutes !== expected.durationMinutes) {
      errors.push(`${expected.title} must be ${expected.durationMinutes} minutes.`);
    }
    if (testModule.questions.length !== expected.questionCount) {
      errors.push(
        `${expected.title} needs ${expected.questionCount} questions; it currently has ${testModule.questions.length}.`,
      );
    }
  });

  return { valid: errors.length === 0, errors };
}

function estimateSingleSectionScore(accuracy: number) {
  const midpoint = Math.round((200 + 600 * accuracy) / 10) * 10;
  const clamped = Math.min(800, Math.max(200, midpoint));
  const lower = Math.max(200, clamped - 30);
  const upper = Math.min(800, clamped + 30);
  return {
    estimatedScore: clamped,
    estimatedScoreRange: [lower, upper] as [number, number],
  };
}

export function buildScoreSummary(
  test: TestDefinition | undefined,
  questions: Question[],
  responses: ResponseRecord[],
): ScoreSummary {
  const responseMap = new Map(
    responses.map((response) => [response.questionId, response.value]),
  );
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const scoredPlacements = (test?.modules ?? [])
    .filter((module) => module.route === "common")
    .flatMap((module) =>
      module.questions
        .filter((placement) => !placement.unscored)
        .map((placement) => ({
          module,
          question: questionMap.get(placement.questionId),
        })),
    )
    .filter(
      (placement): placement is { module: TestModule; question: Question } =>
        Boolean(placement.question),
    );

  const sections: ScoreSectionSummary[] = ["Reading and Writing", "Math"]
    .map((section) => {
      const sectionQuestions = scoredPlacements.filter(
        (placement) => placement.module.section === section,
      );
      const rawTotal = sectionQuestions.length;
      const rawCorrect = sectionQuestions.filter(({ question }) =>
        isResponseCorrect(question, responseMap.get(question.id) ?? ""),
      ).length;
      const accuracy = rawTotal ? rawCorrect / rawTotal : 0;
      return {
        section: section as Section,
        rawCorrect,
        rawTotal,
        accuracy,
        ...estimateSingleSectionScore(accuracy),
      };
    })
    .filter((section) => section.rawTotal > 0);

  const rawTotal = sections.reduce((sum, section) => sum + section.rawTotal, 0);
  const rawCorrect = sections.reduce(
    (sum, section) => sum + section.rawCorrect,
    0,
  );
  const accuracy = rawTotal ? rawCorrect / rawTotal : 0;
  const hasBothSections =
    sections.some((section) => section.section === "Reading and Writing") &&
    sections.some((section) => section.section === "Math");

  const estimatedScoreRange = hasBothSections
    ? ([
        sections.reduce((sum, section) => sum + section.estimatedScoreRange[0], 0),
        sections.reduce((sum, section) => sum + section.estimatedScoreRange[1], 0),
      ] as [number, number])
    : sections[0]?.estimatedScoreRange;
  const estimatedScore = hasBothSections
    ? sections.reduce((sum, section) => sum + section.estimatedScore, 0)
    : sections[0]?.estimatedScore;

  return {
    rawCorrect,
    rawTotal,
    accuracy,
    estimatedScoreRange,
    estimatedScore,
    sections,
    label: "Unofficial tutor-estimated SAT range",
  };
}
