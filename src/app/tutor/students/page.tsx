"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import type { Student } from "@/lib/domain";
import { formatRelativeDate } from "@/lib/utils";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

function makeTemporaryPassword() {
  return `SAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function StudentsPage() {
  const { state, addStudent, updateStudent } = useAppState();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    timeMultiplier: "1",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const students = state.students.filter((student) =>
    `${student.displayName} ${student.username}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  async function createStudent() {
    const password = makeTemporaryPassword();
    const username = form.username.trim().toLowerCase();
    const timeMultiplier = Number(
      form.timeMultiplier,
    ) as Student["timeMultiplier"];
    setCreating(true);
    setCreateError("");
    try {
      let id = crypto.randomUUID();
      if (isSupabaseConfigured() && !isDemoMode()) {
        const response = await fetch("/api/admin/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            displayName: form.displayName.trim(),
            temporaryPassword: password,
            timeMultiplier,
          }),
        });
        const payload = (await response.json()) as {
          id?: string;
          error?: string;
        };
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? "Student creation failed.");
        }
        id = payload.id;
      }
      const student: Student = {
        id,
        displayName: form.displayName.trim(),
        username,
        status: "active",
        mustChangePassword: true,
        temporaryPassword: password,
        timeMultiplier,
        joinedAt: new Date().toISOString(),
        averageAccuracy: 0,
        assignmentsCompleted: 0,
      };
      addStudent(student);
      setCreatedCredentials({ username: student.username, password });
    } catch (studentError) {
      setCreateError(
        studentError instanceof Error
          ? studentError.message
          : "Student creation failed.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Students"
        description="Create private student accounts, manage access, and apply timing accommodations."
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setCreatedCredentials(null);
              setCreateError("");
              setForm({ displayName: "", username: "", timeMultiplier: "1" });
              setCreateOpen(true);
            }}
          >
            Add student
          </Button>
        }
      />

      <Card className="mb-5 p-4">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or username"
            className="pl-10"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Student</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Time</th>
                <th className="px-5 py-4">Accuracy</th>
                <th className="px-5 py-4">Completed</th>
                <th className="px-5 py-4">Last active</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                        {student.displayName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{student.displayName}</p>
                        <p className="text-xs text-slate-500">@{student.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={student.status === "active" ? "green" : "rose"}>
                      {student.status}
                    </Badge>
                    {student.mustChangePassword && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        Password change required
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Select
                      value={student.timeMultiplier}
                      className="w-24 py-2"
                      onChange={(event) =>
                        updateStudent(student.id, {
                          timeMultiplier: Number(
                            event.target.value,
                          ) as Student["timeMultiplier"],
                        })
                      }
                    >
                      <option value="1">1×</option>
                      <option value="1.5">1.5×</option>
                      <option value="2">2×</option>
                    </Select>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold">
                    {Math.round(student.averageAccuracy * 100)}%
                  </td>
                  <td className="px-5 py-4 text-sm font-bold">
                    {student.assignmentsCompleted}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {student.lastActiveAt
                      ? formatRelativeDate(student.lastActiveAt)
                      : "Never"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Issue a new temporary password"
                        icon={<KeyRound className="h-4 w-4" />}
                        onClick={() => {
                          const password = makeTemporaryPassword();
                          updateStudent(student.id, {
                            temporaryPassword: password,
                            mustChangePassword: true,
                          });
                          setCreatedCredentials({
                            username: student.username,
                            password,
                          });
                          setCreateOpen(true);
                        }}
                      />
                      <Button
                        size="sm"
                        variant={student.status === "active" ? "danger" : "ghost"}
                        title={
                          student.status === "active"
                            ? "Disable account"
                            : "Enable account"
                        }
                        icon={
                          student.status === "active" ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )
                        }
                        onClick={() =>
                          updateStudent(student.id, {
                            status:
                              student.status === "active" ? "disabled" : "active",
                          })
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Close className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </Dialog.Close>
            {createdCredentials ? (
              <>
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <KeyRound className="h-6 w-6" />
                </div>
                <Dialog.Title className="mt-4 text-xl font-black">
                  Temporary credentials
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
                  Give these to the student privately. They must choose a new
                  password after signing in.
                </Dialog.Description>
                <div className="mt-5 rounded-xl border bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Username
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {createdCredentials.username}
                  </p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Temporary password
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {createdCredentials.password}
                  </p>
                </div>
                <Dialog.Close asChild>
                  <Button className="mt-5 w-full">Done</Button>
                </Dialog.Close>
              </>
            ) : (
              <>
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <UserRound className="h-6 w-6" />
                </div>
                <Dialog.Title className="mt-4 text-xl font-black">
                  Add a student
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-slate-500">
                  A temporary password will be generated automatically.
                </Dialog.Description>
                <div className="mt-5 space-y-4">
                  <div>
                    <FieldLabel>Display name</FieldLabel>
                    <Input
                      value={form.displayName}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          displayName: event.target.value,
                        }))
                      }
                      placeholder="Student name"
                    />
                  </div>
                  <div>
                    <FieldLabel>Username</FieldLabel>
                    <Input
                      value={form.username}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          username: event.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "."),
                        }))
                      }
                      placeholder="first.last"
                    />
                  </div>
                  <div>
                    <FieldLabel>Time accommodation</FieldLabel>
                    <Select
                      value={form.timeMultiplier}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          timeMultiplier: event.target.value,
                        }))
                      }
                    >
                      <option value="1">Standard time</option>
                      <option value="1.5">Time and one-half</option>
                      <option value="2">Double time</option>
                    </Select>
                  </div>
                </div>
                <Button
                  className="mt-6 w-full"
                  loading={creating}
                  disabled={!form.displayName.trim() || !form.username.trim()}
                  onClick={() => void createStudent()}
                >
                  Create account
                </Button>
                {createError && (
                  <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                    {createError}
                  </p>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
