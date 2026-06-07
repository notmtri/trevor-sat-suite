"use client";

import type {
  Assignment,
  Question,
  Student,
  TestDefinition,
} from "@/lib/domain";

async function request(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
) {
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
}

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
