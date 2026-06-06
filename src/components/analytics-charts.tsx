"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function AnalyticsCharts({
  trend,
  domains,
}: {
  trend: Array<{ date: string; accuracy: number }>;
  domains: Array<{ name: string; accuracy: number }>;
}) {
  const improving =
    trend.length > 1 &&
    trend[trend.length - 1].accuracy >= trend[0].accuracy;
  return (
    <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="min-w-0 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold">Accuracy trend</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cohort average across completed assignments
            </p>
          </div>
          <Badge tone={improving ? "green" : "amber"}>
            {trend.length > 1 ? (improving ? "Improving" : "Needs focus") : "New"}
          </Badge>
        </div>
        <div className="mt-6 h-72 min-h-72 min-w-0">
          {!trend.length ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">
              Completed attempts will appear here.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e8ebf1"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                domain={[40, 100]}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "#e4e8f0" }}
                formatter={(value) => [`${value}%`, "Accuracy"]}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#4767d7"
                strokeWidth={3}
                dot={{ r: 4, fill: "#4767d7" }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="min-w-0 p-6">
        <h2 className="font-extrabold">Domain mastery</h2>
        <p className="mt-1 text-sm text-slate-500">
          Accuracy on scored and simulated unscored items
        </p>
        <div className="mt-6 h-72 min-h-72 min-w-0">
          {!domains.length ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">
              Answer-level data will appear here.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={domains} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e8ebf1"
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={112}
                fontSize={11}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "#e4e8f0" }}
                formatter={(value) => [`${value}%`, "Accuracy"]}
              />
              <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                {domains.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.accuracy >= 75
                        ? "#147d6f"
                        : entry.accuracy >= 65
                          ? "#4767d7"
                          : "#f5b942"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
