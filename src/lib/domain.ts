export type Section = "Math" | "Reading and Writing";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type ResponseType = "multiple_choice" | "student_produced";
export type QuestionStatus = "draft" | "published" | "rejected" | "archived";
export type FeedbackPolicy = "immediate" | "after_submission" | "tutor_release";
export type ChoiceLabel = "A" | "B" | "C" | "D";
export type TestMode = "practice" | "exam";
export type WorkType =
  | "custom"
  | "full_length"
  | "verbal_simulation"
  | "math_simulation"
  | "verbal_practice"
  | "math_practice";

export type QuestionAsset = {
  id: string;
  kind: "prompt" | "rationale";
  order: number;
  sourcePage: number;
  dataUrl?: string;
  storagePath?: string;
  width: number;
  height: number;
};

export type AcceptedAnswer = {
  id: string;
  value: string;
  normalizedValue: string;
};

export type QuestionChoice = {
  label: ChoiceLabel;
  text: string;
};

export type QuestionContent = {
  passage?: string;
  stem?: string;
  choices?: QuestionChoice[];
};

export type Question = {
  id: string;
  sourceId: string;
  versionHash: string;
  assessment: string;
  section: Section;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  responseType: ResponseType;
  acceptedAnswers: AcceptedAnswer[];
  content?: QuestionContent;
  promptAssets: QuestionAsset[];
  rationaleAssets: QuestionAsset[];
  extractedText: string;
  sourceFileName: string;
  sourceDocumentPath?: string;
  importedAt: string;
  status: QuestionStatus;
  tags?: string[];
  reviewNotes?: string;
};

export type Student = {
  id: string;
  username: string;
  displayName: string;
  status: "active" | "disabled";
  temporaryPassword?: string;
  mustChangePassword: boolean;
  timeMultiplier: 1 | 1.5 | 2;
  lastActiveAt?: string;
  joinedAt: string;
  averageAccuracy: number;
  assignmentsCompleted: number;
};

export type TestQuestion = {
  questionId: string;
  order: number;
  unscored?: boolean;
};

export type TestModule = {
  id: string;
  title: string;
  section: Section;
  durationMinutes: number | null;
  route: "common" | "easier" | "harder";
  order: number;
  questions: TestQuestion[];
};

export type TestDefinition = {
  id: string;
  title: string;
  description: string;
  mode: TestMode;
  workType: WorkType;
  status: "draft" | "published";
  modules: TestModule[];
  routingThreshold: number;
  createdAt: string;
};

export type Assignment = {
  id: string;
  testId: string;
  studentIds: string[];
  recipients?: AssignmentRecipient[];
  title: string;
  availableAt: string;
  dueAt: string;
  attemptLimit: number;
  feedbackPolicy: FeedbackPolicy;
  allowResume: boolean;
  status: "scheduled" | "open" | "closed";
  archivedAt?: string;
  archivedBy?: string;
  archivedPreviousStatus?: "scheduled" | "open" | "closed";
};

export type AssignmentRecipient = {
  studentId: string;
  availableAt?: string;
  dueAt?: string;
  attemptLimit?: number;
  status: "assigned" | "extended" | "excused";
  timeMultiplier?: 1 | 1.5 | 2;
};

export type ResponseRecord = {
  questionId: string;
  value: string;
  flagged: boolean;
  eliminatedChoices: string[];
  secondsSpent: number;
  changedCount: number;
};

export type ScoreSectionSummary = {
  section: Section;
  rawCorrect: number;
  rawTotal: number;
  accuracy: number;
  estimatedScoreRange: [number, number];
  estimatedScore: number;
};

export type ScoreSummary = {
  rawCorrect: number;
  rawTotal: number;
  accuracy: number;
  estimatedScoreRange?: [number, number];
  estimatedScore?: number;
  sections: ScoreSectionSummary[];
  label: string;
};

export type Attempt = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: "not_started" | "in_progress" | "submitted" | "expired";
  currentModuleId?: string;
  currentQuestionIndex: number;
  answeredCount: number;
  remainingSeconds?: number;
  connectionStatus: "online" | "offline" | "stale";
  responses: ResponseRecord[];
  route?: "easier" | "harder";
  serverDeadline?: string;
  startedAt?: string;
  submittedAt?: string;
  lastHeartbeatAt?: string;
  rawCorrect?: number;
  rawTotal?: number;
  estimatedScore?: number;
  scoreRange?: [number, number];
  scoreSummary?: ScoreSummary;
  released: boolean;
};

export type TutorSettings = {
  displayName: string;
  landingHeadline: string;
  landingSubheadline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  timezone: string;
  defaultDueDays: number;
  defaultAttemptLimit: number;
  defaultFeedbackPolicy: FeedbackPolicy;
  defaultAllowResume: boolean;
};

export type ReleasedReport = {
  id: string;
  attemptId: string;
  releasedBy?: string;
  summary: {
    tutorComment?: string;
    strengths?: string[];
    nextSteps?: string[];
  };
  releasedAt: string;
};

export type AppState = {
  settings: TutorSettings;
  questions: Question[];
  students: Student[];
  tests: TestDefinition[];
  assignments: Assignment[];
  attempts: Attempt[];
  releasedReports: ReleasedReport[];
};
