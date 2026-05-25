"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  AttendanceChart,
  CHART_ANIMATION,
  CHART_THEME,
  GlassTooltip,
} from "@/components/charts/AttendanceChart";
import { buildClientStoreSnapshot } from "@/lib/client-store";
import {
  getAnomalyData,
  getAttendanceSummary,
  getCoursewiseSummary,
  getDefaulters,
  getSubjectwiseSummary,
  getWeeklyTrend,
  type PotentialAnomaly,
} from "@/lib/analytics";
import { KEYS, getAll, getSettings } from "@/lib/storage";
import { cn, getTodayString } from "@/lib/utils";
import type { AttendanceRecord, Course, Student } from "@/types";

type DatePreset = "7" | "30" | "90" | "custom";

interface ParsedInsight {
  icon: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function filterRecords(
  records: AttendanceRecord[],
  preset: DatePreset,
  customFrom: string,
  customTo: string,
  courseId: string,
  subjectId: string
): AttendanceRecord[] {
  let filtered = records;
  const today = getTodayString();

  if (preset === "custom") {
    if (customFrom) filtered = filtered.filter((r) => r.date >= customFrom);
    if (customTo) filtered = filtered.filter((r) => r.date <= customTo);
  } else {
    const days = Number(preset);
    const from = dateOffset(days - 1);
    filtered = filtered.filter((r) => r.date >= from && r.date <= today);
  }

  if (courseId) filtered = filtered.filter((r) => r.courseId === courseId);
  if (subjectId) filtered = filtered.filter((r) => r.subjectId === subjectId);
  return filtered;
}

function parseInsightsMarkdown(md: string): ParsedInsight[] {
  const blocks = md.split(/^### /m).filter((b) => b.trim());
  return blocks.map((block) => {
    const lines = block.trim().split("\n");
    const titleLine = lines[0] ?? "Insight";
    const emojiMatch = titleLine.match(/^(\p{Extended_Pictographic})/u);
    const icon = emojiMatch?.[1] ?? "💡";
    const title = titleLine.replace(/^[\p{Extended_Pictographic}\s]+/u, "").trim();
    const severityMatch = block.match(
      /\*\*Severity:\*\*\s*(low|medium|high)/i
    );
    const severity = (severityMatch?.[1]?.toLowerCase() ?? "medium") as
      | "low"
      | "medium"
      | "high";
    const description = lines
      .slice(1)
      .filter((l) => !/^\*\*Severity/i.test(l.trim()))
      .join(" ")
      .replace(/\*\*/g, "")
      .trim();

    return { icon, title: title || "Insight", description, severity };
  });
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    case "medium":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    default:
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  }
}

function exportDefaultersCsv(
  defaulters: ReturnType<typeof getDefaulters>
) {
  const header =
    "Rank,Name,Enrollment No,Department,Semester,Batch,Current %,Sessions Needed,Streak\n";
  const rows = defaulters.map((d, i) => {
    const s = d.student;
    return `${i + 1},"${s.name}",${s.enrollmentNo},"${s.department}",${s.semester},${s.batch},${d.currentPercent},${d.sessionsNeeded},${d.streak}`;
  });
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `defaulters-${getTodayString()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>("7");
  const [customFrom, setCustomFrom] = useState(dateOffset(30));
  const [customTo, setCustomTo] = useState(getTodayString());
  const [courseFilter, setCourseFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsMd, setInsightsMd] = useState<string | null>(null);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("sas_dismissed_anomalies");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setDismissedAnomalies(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      "sas_dismissed_anomalies",
      JSON.stringify(Array.from(dismissedAnomalies))
    );
  }, [dismissedAnomalies]);
  const [sortKey, setSortKey] = useState<
    "rank" | "percent" | "streak" | "needed"
  >("percent");

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const { students, courses, settings, filtered, subjects } = useMemo(() => {
    void refreshKey;
    const students = getAll<Student>(KEYS.STUDENTS);
    const courses = getAll<Course>(KEYS.COURSES);
    const settings = getSettings();
    const all = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const filtered = filterRecords(
      all,
      preset,
      customFrom,
      customTo,
      courseFilter,
      subjectFilter
    );
    const subjectSet = new Map<string, string>();
    courses.forEach((c) =>
      c.schedule.forEach((s) => subjectSet.set(s.subjectId, s.subject))
    );
    return { students, courses, settings, filtered, subjects: subjectSet };
  }, [
    refreshKey,
    preset,
    customFrom,
    customTo,
    courseFilter,
    subjectFilter,
  ]);

  const summary = useMemo(
    () => getAttendanceSummary(filtered, students),
    [filtered, students]
  );
  const weeklyTrend = useMemo(
    () =>
      getWeeklyTrend(
        filtered,
        preset === "custom" ? 30 : Number(preset)
      ),
    [filtered, preset]
  );
  const courseSummaries = useMemo(
    () => getCoursewiseSummary(filtered, courses, students),
    [filtered, courses, students]
  );
  const subjectSummaries = useMemo(
    () => getSubjectwiseSummary(filtered, courses),
    [filtered, courses]
  );
  const defaulters = useMemo(() => {
    const list = getDefaulters(
      filtered,
      students,
      settings.minAttendancePercent
    );
    const sorted = [...list];
    if (sortKey === "percent") sorted.sort((a, b) => a.currentPercent - b.currentPercent);
    else if (sortKey === "streak") sorted.sort((a, b) => b.streak - a.streak);
    else if (sortKey === "needed") sorted.sort((a, b) => b.sessionsNeeded - a.sessionsNeeded);
    return sorted;
  }, [filtered, students, settings.minAttendancePercent, sortKey]);

  const anomalies = useMemo(() => {
    const raw = getAnomalyData(filtered, students);
    return raw.filter((a) => !dismissedAnomalies.has(anomalyKey(a)));
  }, [filtered, students, dismissedAnomalies]);

  const parsedInsights = useMemo(
    () => (insightsMd ? parseInsightsMarkdown(insightsMd) : []),
    [insightsMd]
  );

  const pieData = [
    { name: "Present", value: summary.present, color: CHART_THEME.presentGreen },
    { name: "Late", value: summary.late, color: CHART_THEME.late },
    { name: "Absent", value: summary.absent, color: CHART_THEME.absent },
    { name: "Half Day", value: summary.halfDay, color: CHART_THEME.halfDay },
  ].filter((d) => d.value > 0);

  const trendChartData = weeklyTrend.map((t) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const generateInsights = async () => {
    setInsightsLoading(true);
    setInsightsMd(null);
    try {
      const dateRange =
        preset === "custom"
          ? { from: customFrom, to: customTo }
          : { days: Number(preset) };

      const res = await fetch("/api/analytics/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRange,
          courseId: courseFilter || undefined,
          _store: buildClientStoreSnapshot(),
        }),
      });
      const data = (await res.json()) as { insights?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setInsightsMd(data.insights ?? "");
    } catch {
      toast.error("Could not generate AI insights. Check OpenAI API key.");
    } finally {
      setInsightsLoading(false);
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Date range</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {preset === "custom" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-slate-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Course</label>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.courseCode} · {c.courseName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Subject / Paper
          </label>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="">All subjects</option>
            {[...subjects.entries()].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={reload}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Printer className="h-4 w-4" />
          Export PDF
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            AI Insights
          </h2>
          <button
            type="button"
            onClick={generateInsights}
            disabled={insightsLoading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {insightsLoading ? "Generating…" : "Generate Insights"}
          </button>
        </div>

        {insightsLoading && (
          <div className="h-24 animate-pulse rounded-xl bg-gradient-to-r from-indigo-500/20 via-purple-500/30 to-indigo-500/20 bg-[length:200%_100%] shimmer" />
        )}

        <AnimatePresence>
          {parsedInsights.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {parsedInsights.map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-2xl">{insight.icon}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        severityBadgeClass(insight.severity)
                      )}
                    >
                      {insight.severity}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white">{insight.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {insight.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!insightsLoading && !insightsMd && (
          <p className="text-sm text-slate-500">
            Click Generate Insights to analyze attendance patterns with AI.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceChart title="Weekly Attendance Trend" height={280} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_THEME.present} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_THEME.present} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="label" tick={{ fill: CHART_THEME.tick, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART_THEME.tick, fontSize: 11 }} domain={[0, 100]} />
              <RechartsTooltip content={<GlassTooltip />} />
              <Area
                type="monotone"
                dataKey="percent"
                name="Attendance %"
                stroke={CHART_THEME.present}
                fill="url(#trendGrad)"
                {...CHART_ANIMATION}
              />
            </AreaChart>
          </ResponsiveContainer>
        </AttendanceChart>

        <AttendanceChart title="Course-wise Comparison" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={courseSummaries}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis dataKey="courseCode" tick={{ fill: CHART_THEME.tick, fontSize: 10 }} />
              <YAxis tick={{ fill: CHART_THEME.tick, fontSize: 11 }} domain={[0, 100]} />
              <RechartsTooltip content={<GlassTooltip />} />
              <Legend />
              <Bar dataKey="presentPercent" name="Attendance %" fill={CHART_THEME.present} radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
            </BarChart>
          </ResponsiveContainer>
        </AttendanceChart>

        <AttendanceChart title="Subject / Paper Performance" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectSummaries} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: CHART_THEME.tick, fontSize: 11 }} />
              <YAxis type="category" dataKey="subject" width={90} tick={{ fill: CHART_THEME.tick, fontSize: 10 }} />
              <RechartsTooltip content={<GlassTooltip />} />
              <Bar dataKey="presentPercent" name="%" fill={CHART_THEME.presentGreen} radius={[0, 4, 4, 0]} {...CHART_ANIMATION} />
            </BarChart>
          </ResponsiveContainer>
        </AttendanceChart>

        <AttendanceChart title="Attendance Distribution" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                {...CHART_ANIMATION}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip content={<GlassTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </AttendanceChart>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-white">
            Defaulters
          </h3>
          <button
            type="button"
            onClick={() => exportDefaultersCsv(defaulters)}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            <Download className="h-4 w-4" />
            Export Defaulters List
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Department / Sem</th>
                <th
                  className="cursor-pointer py-2 pr-4"
                  onClick={() => setSortKey("percent")}
                >
                  Current %
                </th>
                <th
                  className="cursor-pointer py-2 pr-4"
                  onClick={() => setSortKey("needed")}
                >
                  Sessions Needed
                </th>
                <th
                  className="cursor-pointer py-2 pr-4"
                  onClick={() => setSortKey("streak")}
                >
                  Consecutive Absences
                </th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {defaulters.map((d, i) => {
                const rowClass =
                  d.currentPercent < 60
                    ? "text-red-300"
                    : d.currentPercent < 75
                      ? "text-amber-300"
                      : "text-slate-300";
                return (
                  <tr key={d.student.id} className="border-b border-white/5">
                    <td className={cn("py-3 pr-4", rowClass)}>{i + 1}</td>
                    <td className={cn("py-3 pr-4", rowClass)}>
                      {d.student.name}
                      <span className="ml-1 font-mono text-xs text-slate-500">
                        {d.student.enrollmentNo}
                      </span>
                    </td>
                    <td className={cn("py-3 pr-4 text-xs", rowClass)}>
                      {d.student.department}
                      <br />
                      <span className="text-slate-500">
                        {d.student.semester} Sem · {d.student.batch}
                      </span>
                    </td>
                    <td className={cn("py-3 pr-4 font-medium", rowClass)}>
                      {d.currentPercent}%
                    </td>
                    <td className={cn("py-3 pr-4", rowClass)}>
                      {d.sessionsNeeded}
                    </td>
                    <td className={cn("py-3 pr-4", rowClass)}>{d.streak}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() =>
                          toast.success(
                            `Alert sent to ${d.student.name}`
                          )
                        }
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
                      >
                        Send Alert
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {defaulters.length === 0 && (
            <p className="py-8 text-center text-slate-500">
              No defaulters in this period.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          Anomaly Detection
        </h3>
        {anomalies.length === 0 ? (
          <p className="text-slate-400">No anomalies detected ✓</p>
        ) : (
          <div className="space-y-3">
            {anomalies.map((a) => (
              <AnomalyCard
                key={anomalyKey(a)}
                anomaly={a}
                students={students}
                onDismiss={() =>
                  setDismissedAnomalies((s) => new Set(s).add(anomalyKey(a)))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function anomalyKey(a: PotentialAnomaly): string {
  return `${a.type}-${a.studentIds.join("-")}`;
}

function AnomalyCard({
  anomaly,
  students,
  onDismiss,
}: {
  anomaly: PotentialAnomaly;
  students: Student[];
  onDismiss: () => void;
}) {
  const names = anomaly.studentIds
    .map((id) => students.find((s) => s.id === id)?.name ?? id)
    .filter(Boolean);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex-1">
        <span
          className={cn(
            "mb-2 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase",
            severityBadgeClass(anomaly.severity)
          )}
        >
          {anomaly.type.replace("-", " ")}
        </span>
        <p className="text-sm text-slate-300">{anomaly.description}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {names.map((n) => (
            <span
              key={n}
              className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
      >
        <X className="h-3 w-3" />
        Dismiss
      </button>
    </div>
  );
}
