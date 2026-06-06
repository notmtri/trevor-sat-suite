"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

export default function MonitorPage() {
  const { state } = useAppState();
  const [tick, setTick] = useState(0);
  const active = state.attempts.filter(
    (attempt) => attempt.status === "in_progress",
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Live"
        title="Session monitor"
        description="See position, pacing, and connection health without viewing student answer content."
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => setTick(0)}
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black">{active.length}</p>
              <p className="text-sm font-semibold text-slate-500">Testing now</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black">
                {active.filter((item) => item.connectionStatus === "online").length}
              </p>
              <p className="text-sm font-semibold text-slate-500">
                Healthy connections
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black">
                {
                  state.attempts.filter((item) => item.status === "submitted")
                    .length
                }
              </p>
              <p className="text-sm font-semibold text-slate-500">
                Submitted today
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {active.map((attempt) => {
          const student = state.students.find(
            (item) => item.id === attempt.studentId,
          );
          const assignment = state.assignments.find(
            (item) => item.id === attempt.assignmentId,
          );
          const test = state.tests.find((item) => item.id === assignment?.testId);
          const activeModule = test?.modules.find(
            (item) => item.id === attempt.currentModuleId,
          );
          const totalQuestions = activeModule?.questions.length ?? 0;
          const remaining = Math.max(0, (attempt.remainingSeconds ?? 0) - tick);
          return (
            <Card key={attempt.id} className="overflow-hidden">
              <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                <div className="flex items-center gap-4">
                  <div className="relative grid h-13 w-13 place-items-center rounded-full bg-[var(--mint)] font-black text-[var(--green)]">
                    {student?.displayName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div>
                    <p className="font-black">{student?.displayName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {assignment?.title} · {activeModule?.title}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Position
                  </p>
                  <p className="mt-1 font-black">
                    Question {attempt.currentQuestionIndex + 1} of {totalQuestions}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Answered
                  </p>
                  <p className="mt-1 font-black">
                    {attempt.answeredCount} of {totalQuestions}
                  </p>
                </div>
                <div className="min-w-36 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" /> Remaining
                  </p>
                  <p className="mt-1 font-mono text-xl font-black text-[var(--navy)]">
                    {formatDuration(remaining)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-6 py-3">
                <div className="flex items-center gap-3">
                  <Badge tone="green">
                    <Activity className="mr-1 h-3 w-3" /> heartbeat healthy
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">
                    Time accommodation: {student?.timeMultiplier}×
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  Answer content hidden
                </span>
              </div>
            </Card>
          );
        })}

        {!active.length && (
          <Card className="py-20 text-center">
            <WifiOff className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 font-bold">No active sessions</p>
            <p className="mt-1 text-sm text-slate-500">
              Student heartbeats will appear here within about 15 seconds.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
