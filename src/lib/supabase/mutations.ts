"use client";

import type {
  Assignment,
  Attempt,
  Question,
  ReleasedReport,
  Student,
  TestDefinition,
  TutorSettings,
} from "@/lib/domain";

async function request<T = void>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "The server rejected this change.");
  }
  return payload as T;
}

export type AssignmentArchiveState = Pick<Assignment, "id" | "status"> & {
  archivedAt: string | null;
  archivedBy: string | null;
  archivedPreviousStatus: Assignment["status"] | null;
};

export function persistQuestionChanges(
  id: string,
  changes: Partial<Question>,
) {
  return request("/api/admin/questions", "PATCH", {
    id,
    status: changes.status,
    section: changes.section,
    domain: changes.domain,
    skill: changes.skill,
    difficulty: changes.difficulty,
    tags: changes.tags,
  });
}

export function persistQuestionDelete(id: string) {
  return request("/api/admin/questions", "DELETE", { id });
}

export function persistStudentChanges(id: string, changes: Partial<Student>) {
  return request("/api/admin/students", "PATCH", {
    id,
    status: changes.status,
    timeMultiplier: changes.timeMultiplier,
    temporaryPassword: changes.temporaryPassword,
  });
}

export function persistTest(test: TestDefinition) {
  return request("/api/admin/tests", "POST", test);
}

export function persistAssignment(assignment: Assignment) {
  return request("/api/admin/assignments", "POST", assignment);
}

export function persistAssignmentChanges(
  id: string,
  changes: Partial<Assignment>,
) {
  return request("/api/admin/assignments", "PATCH", {
    id,
    title: changes.title,
    availableAt: changes.availableAt,
    dueAt: changes.dueAt,
    attemptLimit: changes.attemptLimit,
    feedbackPolicy: changes.feedbackPolicy,
    allowResume: changes.allowResume,
    status: changes.status,
    recipients: changes.recipients,
  });
}

export function persistAssignmentDelete(id: string) {
  return request<{ assignment: AssignmentArchiveState }>(
    "/api/admin/assignments",
    "DELETE",
    { id },
  );
}

export function persistAssignmentRestore(id: string) {
  return request<{ assignment: AssignmentArchiveState }>(
    "/api/admin/assignments",
    "PATCH",
    { id, restore: true },
  );
}

export function persistAttemptChanges(
  id: string,
  changes: Partial<Attempt>,
  report?: ReleasedReport,
) {
  return request("/api/admin/attempts", "PATCH", {
    id,
    released: changes.released,
    status: changes.status,
    report,
  });
}

export function persistTutorSettings(changes: Partial<TutorSettings>) {
  return request("/api/admin/settings", "PATCH", changes);
}
