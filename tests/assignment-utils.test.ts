import { describe, expect, it } from "vitest";
import type { AppState, Assignment, Attempt } from "@/lib/domain";
import {
  getStudentAssignmentCards,
  getStudentAssignmentStatus,
  getStudentResultAttempts,
  getTutorNotifications,
} from "@/lib/assignment-utils";
import { defaultTutorSettings } from "@/lib/settings";

const assignment: Assignment = {
  id: "assignment-1",
  testId: "test-1",
  studentIds: ["student-1"],
  title: "Algebra Set",
  availableAt: "2026-06-08T00:00:00.000Z",
  dueAt: "2026-06-10T00:00:00.000Z",
  attemptLimit: 1,
  feedbackPolicy: "tutor_release",
  allowResume: true,
  status: "open",
};

function state(attempts: Attempt[] = []): AppState {
  return {
    settings: defaultTutorSettings,
    questions: [],
    students: [
      {
        id: "student-1",
        username: "student.one",
        displayName: "Student One",
        status: "active",
        mustChangePassword: false,
        timeMultiplier: 1,
        joinedAt: "2026-06-01T00:00:00.000Z",
        averageAccuracy: 0,
        assignmentsCompleted: 0,
      },
    ],
    tests: [],
    assignments: [assignment],
    attempts,
    releasedReports: [],
  };
}

describe("assignment lifecycle helpers", () => {
  it("marks an available assignment due within 48 hours as due soon", () => {
    expect(
      getStudentAssignmentStatus(
        assignment,
        "student-1",
        [],
        new Date("2026-06-08T12:00:00.000Z"),
      ),
    ).toBe("due_soon");
  });

  it("marks a submitted attempt as retake available only when attempts remain", () => {
    const submitted: Attempt = {
      id: "attempt-1",
      assignmentId: assignment.id,
      studentId: "student-1",
      status: "submitted",
      currentQuestionIndex: 0,
      answeredCount: 1,
      connectionStatus: "online",
      responses: [],
      released: false,
    };
    expect(
      getStudentAssignmentStatus(assignment, "student-1", [submitted]),
    ).toBe("submitted");
    expect(
      getStudentAssignmentStatus(
        { ...assignment, attemptLimit: 2 },
        "student-1",
        [submitted],
      ),
    ).toBe("retake_available");
  });

  it("applies individual due date and attempt overrides", () => {
    const cards = getStudentAssignmentCards(
      {
        ...state(),
        assignments: [
          {
            ...assignment,
            recipients: [
              {
                studentId: "student-1",
                status: "extended",
                dueAt: "2026-06-20T00:00:00.000Z",
                attemptLimit: 3,
              },
            ],
          },
        ],
      },
      "student-1",
    );
    expect(cards[0]).toMatchObject({
      effectiveDueAt: "2026-06-20T00:00:00.000Z",
      effectiveAttemptLimit: 3,
    });
  });

  it("keeps excused recipients visible without counting them as active", () => {
    const cards = getStudentAssignmentCards(
      {
        ...state(),
        assignments: [
          {
            ...assignment,
            studentIds: [],
            recipients: [{ studentId: "student-1", status: "excused" }],
          },
        ],
      },
      "student-1",
    );

    expect(cards[0]).toMatchObject({
      attemptsUsed: 0,
      status: "excused",
      label: "Excused",
    });
  });

  it("excludes archived assignments from active student cards", () => {
    const cards = getStudentAssignmentCards(
      {
        ...state(),
        assignments: [
          { ...assignment, archivedAt: "2026-06-09T00:00:00.000Z" },
        ],
      },
      "student-1",
    );

    expect(cards).toEqual([]);
  });

  it("keeps released archived results and hides unreleased archived attempts", () => {
    const releasedAttempt: Attempt = {
      id: "attempt-released",
      assignmentId: assignment.id,
      studentId: "student-1",
      status: "submitted",
      currentQuestionIndex: 0,
      answeredCount: 1,
      connectionStatus: "online",
      responses: [],
      rawCorrect: 1,
      rawTotal: 1,
      released: true,
    };
    const unreleasedAttempt: Attempt = {
      ...releasedAttempt,
      id: "attempt-unreleased",
      status: "expired",
      released: false,
    };
    const result = getStudentResultAttempts({
      ...state([releasedAttempt, unreleasedAttempt]),
      assignments: [
        { ...assignment, archivedAt: "2026-06-09T00:00:00.000Z" },
      ],
    });

    expect(result.released.map((attempt) => attempt.id)).toEqual([
      "attempt-released",
    ]);
    expect(result.unreleased).toEqual([]);
  });

  it("does not create notifications for archived assignments", () => {
    const expiredAttempt: Attempt = {
      id: "attempt-expired",
      assignmentId: assignment.id,
      studentId: "student-1",
      status: "expired",
      currentQuestionIndex: 0,
      answeredCount: 0,
      connectionStatus: "stale",
      responses: [],
      released: false,
    };
    const archivedState = {
      ...state([expiredAttempt]),
      assignments: [
        { ...assignment, archivedAt: "2026-06-09T00:00:00.000Z" },
      ],
    };

    expect(
      getTutorNotifications(
        archivedState,
        new Date("2026-06-12T00:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("notifies the tutor when a submitted report needs review", () => {
    const attempt: Attempt = {
      id: "attempt-1",
      assignmentId: assignment.id,
      studentId: "student-1",
      status: "submitted",
      currentQuestionIndex: 0,
      answeredCount: 1,
      connectionStatus: "online",
      responses: [],
      released: false,
    };
    expect(getTutorNotifications(state([attempt]))[0]).toMatchObject({
      title: "Review ready",
      tone: "amber",
    });
  });
});
