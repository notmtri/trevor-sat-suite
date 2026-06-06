import type {
  AppState,
  Difficulty,
  Question,
  ResponseType,
  Section,
} from "@/lib/domain";
import { makeAcceptedAnswers } from "@/lib/scoring";

function svgDataUrl(title: string, lines: string[], accent = "#233876") {
  const escaped = [title, ...lines].map((line) =>
    line
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
  );
  const lineMarkup = escaped
    .slice(1)
    .map(
      (line, index) =>
        `<text x="44" y="${112 + index * 40}" font-family="Arial, sans-serif" font-size="22" fill="#172033">${line}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${Math.max(360, 170 + lines.length * 40)}" viewBox="0 0 1100 ${Math.max(360, 170 + lines.length * 40)}">
    <rect width="100%" height="100%" rx="18" fill="#ffffff"/>
    <rect x="0" y="0" width="12" height="100%" rx="6" fill="${accent}"/>
    <text x="44" y="62" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="${accent}">${escaped[0]}</text>
    ${lineMarkup}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function demoQuestion(
  sourceId: string,
  section: Section,
  domain: string,
  skill: string,
  difficulty: Difficulty,
  responseType: ResponseType,
  answer: string[],
  lines: string[],
): Question {
  const dataUrl = svgDataUrl(`Question ID: ${sourceId}`, lines);
  const rationale = svgDataUrl("Rationale", [
    `The correct answer is ${answer.join(" or ")}.`,
    "Review the relationship in the prompt, then substitute carefully.",
  ], "#147d6f");
  return {
    id: `question-${sourceId}`,
    sourceId,
    versionHash: `demo-${sourceId}`,
    assessment: "SAT",
    section,
    domain,
    skill,
    difficulty,
    responseType,
    acceptedAnswers: makeAcceptedAnswers(answer),
    promptAssets: [
      {
        id: `asset-${sourceId}-prompt`,
        kind: "prompt",
        order: 0,
        sourcePage: 1,
        dataUrl,
        width: 1100,
        height: 420,
      },
    ],
    rationaleAssets: [
      {
        id: `asset-${sourceId}-rationale`,
        kind: "rationale",
        order: 0,
        sourcePage: 1,
        dataUrl: rationale,
        width: 1100,
        height: 360,
      },
    ],
    extractedText: lines.join(" "),
    sourceFileName: "Demo Question Bank",
    importedAt: "2026-06-06T08:00:00.000Z",
    status: "published",
  };
}

const demoQuestions = [
  demoQuestion(
    "ac472881",
    "Math",
    "Algebra",
    "Linear equations in one variable",
    "Hard",
    "student_produced",
    ["403"],
    [
      "In the given equation, s and r are constants, and s > 0.",
      "If the equation has infinitely many solutions, what is the value of s?",
      "Enter your answer in the box.",
    ],
  ),
  demoQuestion(
    "3f5a3602",
    "Math",
    "Algebra",
    "Systems of two linear equations",
    "Hard",
    "multiple_choice",
    ["D"],
    [
      "What system of linear equations is represented by the lines shown?",
      "A. 8x + 4y = 32; -10x - 4y = -64",
      "B. 8x - 4y = 32; -10x + 4y = -64",
      "C. 4x - 10y = 32; -8x + 10y = -64",
      "D. 4x + 10y = 32; -8x - 10y = -64",
    ],
  ),
  demoQuestion(
    "3d1070c9",
    "Math",
    "Algebra",
    "Linear functions",
    "Easy",
    "multiple_choice",
    ["C"],
    [
      "The function f is defined by f(x) = 25x + 30.",
      "What is the value of f(x) when x = 2?",
      "A. 50     B. 57     C. 80     D. 110",
    ],
  ),
  demoQuestion(
    "rw-demo-1",
    "Reading and Writing",
    "Craft and Structure",
    "Words in Context",
    "Medium",
    "multiple_choice",
    ["B"],
    [
      "The researcher described the result as provisional because further",
      "evidence might alter the conclusion.",
      "As used in the text, “provisional” most nearly means:",
      "A. celebrated   B. temporary   C. unexpected   D. complete",
    ],
  ),
];

const now = new Date("2026-06-06T09:00:00.000Z");

export const demoState: AppState = {
  questions: demoQuestions,
  students: [
    {
      id: "student-minh",
      username: "minh.nguyen",
      displayName: "Minh Nguyen",
      status: "active",
      mustChangePassword: false,
      timeMultiplier: 1,
      joinedAt: "2026-04-12T08:00:00.000Z",
      lastActiveAt: "2026-06-06T08:56:00.000Z",
      averageAccuracy: 0.78,
      assignmentsCompleted: 8,
    },
    {
      id: "student-linh",
      username: "linh.tran",
      displayName: "Linh Tran",
      status: "active",
      mustChangePassword: false,
      timeMultiplier: 1.5,
      joinedAt: "2026-05-02T08:00:00.000Z",
      lastActiveAt: "2026-06-05T13:20:00.000Z",
      averageAccuracy: 0.69,
      assignmentsCompleted: 5,
    },
    {
      id: "student-alex",
      username: "alex.vo",
      displayName: "Alex Vo",
      status: "active",
      mustChangePassword: true,
      timeMultiplier: 1,
      joinedAt: "2026-06-01T08:00:00.000Z",
      averageAccuracy: 0.61,
      assignmentsCompleted: 1,
    },
  ],
  tests: [
    {
      id: "test-algebra-checkpoint",
      title: "Algebra Checkpoint",
      description: "A focused practice set covering linear equations and functions.",
      mode: "practice",
      status: "published",
      routingThreshold: 0.6,
      createdAt: "2026-06-03T08:00:00.000Z",
      modules: [
        {
          id: "module-algebra",
          title: "Math Practice",
          section: "Math",
          durationMinutes: 20,
          route: "common",
          order: 1,
          questions: demoQuestions
            .filter((question) => question.section === "Math")
            .map((question, index) => ({
              questionId: question.id,
              order: index + 1,
            })),
        },
      ],
    },
    {
      id: "test-digital-sat",
      title: "Digital SAT Simulation 1",
      description: "A Bluebook-inspired adaptive simulation.",
      mode: "exam",
      status: "draft",
      routingThreshold: 0.6,
      createdAt: "2026-06-05T08:00:00.000Z",
      modules: [],
    },
  ],
  assignments: [
    {
      id: "assignment-algebra",
      testId: "test-algebra-checkpoint",
      studentIds: ["student-minh", "student-linh", "student-alex"],
      title: "Algebra Checkpoint",
      availableAt: "2026-06-05T00:00:00.000Z",
      dueAt: "2026-06-12T16:59:00.000Z",
      attemptLimit: 2,
      feedbackPolicy: "after_submission",
      allowResume: true,
      status: "open",
    },
  ],
  attempts: [
    {
      id: "attempt-minh-live",
      assignmentId: "assignment-algebra",
      studentId: "student-minh",
      status: "in_progress",
      currentModuleId: "module-algebra",
      currentQuestionIndex: 1,
      answeredCount: 1,
      remainingSeconds: 842,
      connectionStatus: "online",
      responses: [],
      startedAt: new Date(now.getTime() - 6 * 60_000).toISOString(),
      lastHeartbeatAt: now.toISOString(),
      released: false,
    },
    {
      id: "attempt-linh-complete",
      assignmentId: "assignment-algebra",
      studentId: "student-linh",
      status: "submitted",
      currentQuestionIndex: 2,
      answeredCount: 3,
      connectionStatus: "online",
      responses: [],
      startedAt: "2026-06-05T12:00:00.000Z",
      submittedAt: "2026-06-05T12:16:00.000Z",
      rawCorrect: 2,
      rawTotal: 3,
      released: true,
    },
  ],
};
