"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight, Clock3, Target, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isResponseCorrect } from "@/lib/scoring";

const AnalyticsCharts = dynamic(
  () => import("@/components/analytics-charts"),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="h-96 animate-pulse bg-slate-50" />
        <Card className="h-96 animate-pulse bg-slate-50" />
      </div>
    ),
  },
);

export default function AnalyticsPage() {
  const { state } = useAppState();
  const analytics = useMemo(() => {
    const completed = state.attempts.filter(
      (attempt) =>
        (attempt.status === "submitted" || attempt.status === "expired") &&
        (attempt.rawTotal ?? 0) > 0,
    );
    const averageAccuracy = completed.length
      ? completed.reduce(
          (sum, attempt) =>
            sum + (attempt.rawCorrect ?? 0) / Math.max(1, attempt.rawTotal ?? 0),
          0,
        ) / completed.length
      : 0;
    const responses = completed.flatMap((attempt) => attempt.responses);
    const timedResponses = responses.filter((response) => response.secondsSpent > 0);
    const averagePace = timedResponses.length
      ? timedResponses.reduce(
          (sum, response) => sum + response.secondsSpent,
          0,
        ) / timedResponses.length
      : 0;
    const domainMap = new Map<
      string,
      { correct: number; total: number; seconds: number }
    >();
    for (const response of responses) {
      const question = state.questions.find(
        (item) => item.id === response.questionId,
      );
      if (!question) continue;
      const current = domainMap.get(question.domain) ?? {
        correct: 0,
        total: 0,
        seconds: 0,
      };
      current.total += 1;
      current.seconds += response.secondsSpent;
      if (isResponseCorrect(question, response.value)) current.correct += 1;
      domainMap.set(question.domain, current);
    }
    const domains = [...domainMap.entries()]
      .map(([name, value]) => ({
        name,
        accuracy: Math.round((value.correct / Math.max(1, value.total)) * 100),
        pace: Math.round(value.seconds / Math.max(1, value.total)),
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
    const trend = completed
      .filter((attempt) => attempt.submittedAt)
      .sort(
        (a, b) =>
          new Date(a.submittedAt!).getTime() -
          new Date(b.submittedAt!).getTime(),
      )
      .slice(-10)
      .map((attempt) => ({
        date: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(new Date(attempt.submittedAt!)),
        accuracy: Math.round(
          ((attempt.rawCorrect ?? 0) / Math.max(1, attempt.rawTotal ?? 0)) * 100,
        ),
      }));
    return {
      completed,
      averageAccuracy,
      averagePace,
      domains,
      trend,
    };
  }, [state.attempts, state.questions]);
  const strongest = analytics.domains[0];
  const priorities = [...analytics.domains]
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="Accuracy, pacing, and mastery trends across released and unreleased attempts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Average accuracy",
            `${Math.round(analytics.averageAccuracy * 100)}%`,
            `${analytics.completed.length} scored attempts`,
            Target,
            "text-blue-700 bg-blue-50",
          ],
          [
            "Average pace",
            analytics.averagePace ? `${Math.round(analytics.averagePace)} sec` : "—",
            analytics.averagePace ? "Per answered question" : "No timing data yet",
            Clock3,
            "text-violet-700 bg-violet-50",
          ],
          [
            "Completed attempts",
            String(analytics.completed.length),
            `Across ${state.students.length} students`,
            TrendingUp,
            "text-emerald-700 bg-emerald-50",
          ],
          [
            "Strongest domain",
            strongest?.name ?? "—",
            strongest ? `${strongest.accuracy}% accuracy` : "No response data yet",
            ArrowUpRight,
            "text-amber-700 bg-amber-50",
          ],
        ].map(([label, value, detail, Icon, tone]) => {
          const ItemIcon = Icon as typeof Target;
          return (
            <Card key={label as string} className="p-5">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
                <ItemIcon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                {label as string}
              </p>
              <p className="mt-1 text-2xl font-black">{value as string}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {detail as string}
              </p>
            </Card>
          );
        })}
      </div>

      <AnalyticsCharts
        trend={analytics.trend}
        domains={analytics.domains.map(({ name, accuracy }) => ({
          name,
          accuracy,
        }))}
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b px-6 py-5">
          <h2 className="font-extrabold">Priority skills</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recommended next steps based on accuracy and excess time.
          </p>
        </div>
        <div className="divide-y">
          {priorities.map((domain, index) => (
            <div
              key={domain.name}
              className="grid gap-3 px-6 py-4 md:grid-cols-[1.2fr_1fr_100px_100px_100px] md:items-center"
            >
              <p className="text-sm font-bold">{domain.name}</p>
              <p className="text-sm text-slate-600">Review assigned skills</p>
              <p className="text-sm font-black">{domain.accuracy}%</p>
              <p className="text-sm font-semibold text-slate-500">
                {domain.pace ? `${domain.pace} sec` : "—"}
              </p>
              <Badge tone={index === 0 ? "rose" : "amber"}>
                {index === 0 ? "High" : "Medium"}
              </Badge>
            </div>
          ))}
          {!priorities.length && (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Priority skills will appear after students submit responses.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
