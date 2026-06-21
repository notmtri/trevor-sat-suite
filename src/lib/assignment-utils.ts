import type {
  AppState,
  Assignment,
  AssignmentRecipient,
  Attempt,
  Student,
} from "@/lib/domain";

export type StudentAssignmentStatus =
  | "scheduled"
  | "open"
  | "due_soon"
  | "overdue"
  | "in_progress"
  | "submitted"
  | "released"
  | "retake_available"
  | "closed"
  | "excused";

export type StudentAssignmentCard = {
  assignment: Assignment;
  effectiveAvailableAt: string;
  effectiveDueAt: string;
  effectiveAttemptLimit: number;
  attemptsUsed: number;
  latestAttempt?: Attempt;
  status: StudentAssignmentStatus;
  label: string;
};

export function isAssignmentArchived(assignment: Assignment | undefined) {
  return Boolean(assignment?.archivedAt);
}

export function getAssignmentRecipients(assignment: Assignment) {
  if (assignment.recipients?.length) return assignment.recipients;
  return assignment.studentIds.map<AssignmentRecipient>((studentId) => ({
    studentId,
    status: "assigned",
  }));
}

export function getRecipient(
  assignment: Assignment,
  studentId: string,
): AssignmentRecipient | undefined {
  return getAssignmentRecipients(assignment).find(
    (recipient) => recipient.studentId === studentId,
  );
}

export function assignmentIncludesStudent(
  assignment: Assignment,
  studentId: string,
) {
  return Boolean(getRecipient(assignment, studentId));
}

export function getEffectiveAssignmentWindow(
  assignment: Assignment,
  studentId: string,
) {
  const recipient = getRecipient(assignment, studentId);
  return {
    availableAt: recipient?.availableAt ?? assignment.availableAt,
    dueAt: recipient?.dueAt ?? assignment.dueAt,
    attemptLimit: recipient?.attemptLimit ?? assignment.attemptLimit,
    recipientStatus: recipient?.status ?? "assigned",
  };
}

export function getAttemptsForAssignmentStudent(
  attempts: Attempt[],
  assignmentId: string,
  studentId: string,
) {
  return attempts.filter(
    (attempt) =>
      attempt.assignmentId === assignmentId && attempt.studentId === studentId,
  );
}

export function getLatestAttempt(attempts: Attempt[]) {
  return [...attempts].sort((a, b) => {
    const aTime = new Date(
      a.submittedAt ?? a.startedAt ?? a.lastHeartbeatAt ?? 0,
    ).getTime();
    const bTime = new Date(
      b.submittedAt ?? b.startedAt ?? b.lastHeartbeatAt ?? 0,
    ).getTime();
    return bTime - aTime;
  })[0];
}

export function getStudentAssignmentStatus(
  assignment: Assignment,
  studentId: string,
  attempts: Attempt[],
  now = new Date(),
): StudentAssignmentStatus {
  const { availableAt, dueAt, attemptLimit, recipientStatus } =
    getEffectiveAssignmentWindow(assignment, studentId);
  if (recipientStatus === "excused") return "excused";
  if (assignment.status === "closed") return "closed";

  const availableTime = new Date(availableAt).getTime();
  const dueTime = new Date(dueAt).getTime();
  const nowTime = now.getTime();
  const latestAttempt = getLatestAttempt(attempts);

  if (latestAttempt?.released) return "released";
  if (latestAttempt?.status === "submitted" || latestAttempt?.status === "expired") {
    return attempts.length < attemptLimit ? "retake_available" : "submitted";
  }
  if (latestAttempt?.status === "in_progress") return "in_progress";
  if (assignment.status === "scheduled" || nowTime < availableTime) {
    return "scheduled";
  }
  if (nowTime > dueTime) return "overdue";
  if (dueTime - nowTime <= 48 * 60 * 60 * 1000) return "due_soon";
  return "open";
}

export function assignmentStatusLabel(status: StudentAssignmentStatus) {
  const labels: Record<StudentAssignmentStatus, string> = {
    scheduled: "Scheduled",
    open: "Open",
    due_soon: "Due soon",
    overdue: "Overdue",
    in_progress: "In progress",
    submitted: "Submitted",
    released: "Released",
    retake_available: "Retake available",
    closed: "Closed",
    excused: "Excused",
  };
  return labels[status];
}

export function getStudentAssignmentCards(
  state: AppState,
  studentId: string,
  now = new Date(),
): StudentAssignmentCard[] {
  return state.assignments
    .filter(
      (assignment) =>
        !isAssignmentArchived(assignment) &&
        assignmentIncludesStudent(assignment, studentId),
    )
    .map((assignment) => {
      const attempts = getAttemptsForAssignmentStudent(
        state.attempts,
        assignment.id,
        studentId,
      );
      const latestAttempt = getLatestAttempt(attempts);
      const window = getEffectiveAssignmentWindow(assignment, studentId);
      const status = getStudentAssignmentStatus(
        assignment,
        studentId,
        attempts,
        now,
      );
      return {
        assignment,
        effectiveAvailableAt: window.availableAt,
        effectiveDueAt: window.dueAt,
        effectiveAttemptLimit: window.attemptLimit,
        attemptsUsed: attempts.filter((attempt) =>
          ["in_progress", "submitted", "expired"].includes(attempt.status),
        ).length,
        latestAttempt,
        status,
        label: assignmentStatusLabel(status),
      };
    })
    .sort(
      (a, b) =>
        new Date(a.effectiveDueAt).getTime() -
        new Date(b.effectiveDueAt).getTime(),
    );
}

export function getStudentResultAttempts(state: AppState) {
  const assignmentMap = new Map(
    state.assignments.map((assignment) => [assignment.id, assignment]),
  );
  return {
    released: state.attempts.filter(
      (attempt) => attempt.released && Boolean(attempt.rawTotal),
    ),
    unreleased: state.attempts.filter(
      (attempt) =>
        !attempt.released &&
        (attempt.status === "submitted" || attempt.status === "expired") &&
        !isAssignmentArchived(assignmentMap.get(attempt.assignmentId)),
    ),
  };
}

export function getTutorNotifications(state: AppState, now = new Date()) {
  const notifications: Array<{
    id: string;
    tone: "blue" | "green" | "amber" | "rose";
    title: string;
    detail: string;
  }> = [];

  for (const attempt of state.attempts) {
    const assignment = state.assignments.find(
      (item) => item.id === attempt.assignmentId,
    );
    const student = state.students.find((item) => item.id === attempt.studentId);
    if (!assignment || isAssignmentArchived(assignment) || !student) continue;
    if (
      (attempt.status === "submitted" || attempt.status === "expired") &&
      !attempt.released
    ) {
      notifications.push({
        id: `review-${attempt.id}`,
        tone: "amber",
        title: "Review ready",
        detail: `${student.displayName} submitted ${assignment.title}.`,
      });
    }
    if (attempt.released) {
      notifications.push({
        id: `released-${attempt.id}`,
        tone: "green",
        title: "Report released",
        detail: `${assignment.title} is visible to ${student.displayName}.`,
      });
    }
  }

  for (const assignment of state.assignments) {
    if (isAssignmentArchived(assignment)) continue;
    const dueTime = new Date(assignment.dueAt).getTime();
    if (
      assignment.status !== "closed" &&
      dueTime < now.getTime() &&
      assignment.studentIds.some((studentId) => {
        const attempts = getAttemptsForAssignmentStudent(
          state.attempts,
          assignment.id,
          studentId,
        );
        return !attempts.some((attempt) =>
          ["submitted", "expired"].includes(attempt.status),
        );
      })
    ) {
      notifications.push({
        id: `overdue-${assignment.id}`,
        tone: "rose",
        title: "Overdue assignment",
        detail: `${assignment.title} has students who have not submitted.`,
      });
    }
  }

  return notifications.slice(0, 6);
}

export function summarizeStudentProgress(
  state: AppState,
  student: Student,
) {
  const attempts = state.attempts.filter(
    (attempt) => attempt.studentId === student.id,
  );
  const scored = attempts.filter((attempt) => (attempt.rawTotal ?? 0) > 0);
  const released = scored.filter((attempt) => attempt.released);
  const accuracy = scored.length
    ? scored.reduce(
        (sum, attempt) =>
          sum + (attempt.rawCorrect ?? 0) / Math.max(1, attempt.rawTotal ?? 0),
        0,
      ) / scored.length
    : 0;
  return {
    attempts,
    scored,
    released,
    accuracy,
    completed: attempts.filter((attempt) =>
      ["submitted", "expired"].includes(attempt.status),
    ).length,
  };
}
