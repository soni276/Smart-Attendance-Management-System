"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, Printer, Search, UserX } from "lucide-react";
import toast from "react-hot-toast";
import {
  CHART_ANIMATION,
  CHART_THEME,
  GlassTooltip,
} from "@/components/charts/AttendanceChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getWeeklyTrend } from "@/lib/analytics";
import { KEYS, getAll, getCurrentUser, getSettings } from "@/lib/storage";
import {
  calculateAttendancePercent,
  cn,
  formatDate,
  getTodayString,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  Student,
  Teacher,
} from "@/types";

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv =
    header.map(escape).join(",") +
    "\n" +
    rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface StudentRow {
  student: Student;
  className: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  percent: number;
}

export default function TeacherReportsPage() {
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [from, setFrom] = useState(dateOffset(30));
  const [to, setTo] = useState(getTodayString());
  const [search, setSearch] = useState("");

  const data = useMemo(() => {
    if (typeof window === "undefined") return null;
    const user = getCurrentUser();
    if (!user || user.role !== "teacher") return null;

    const teachers = getAll<Teacher>(KEYS.TEACHERS);
    const teacher =
      teachers.find((t) => t.id === user.userId) ??
      teachers.find((t) => t.email === user.email);
    if (!teacher) return null;

    const classes = getAll<ClassRoom>(KEYS.CLASSES);
    const myClasses = classes.filter((c) => teacher.classIds.includes(c.id));
    const allStudents = getAll<Student>(KEYS.STUDENTS);
    const allRecords = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const settings = getSettings();

    return { teacher, myClasses, allStudents, allRecords, settings };
  }, []);

  useEffect(() => {
    setLoading(false);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    const myClassIds = new Set(data.myClasses.map((c) => c.id));
    const inRange = data.allRecords.filter(
      (r) =>
        myClassIds.has(r.classId) &&
        r.date >= from &&
        r.date <= to &&
        (classFilter === "all" || r.classId === classFilter)
    );
    return inRange;
  }, [data, from, to, classFilter]);

  const studentRows: StudentRow[] = useMemo(() => {
    if (!data || !filtered) return [];
    const myClassIds =
      classFilter === "all"
        ? new Set(data.myClasses.map((c) => c.id))
        : new Set([classFilter]);

    const rows: StudentRow[] = [];
    const classMap = new Map(data.myClasses.map((c) => [c.id, c]));

    data.allStudents
      .filter((s) => myClassIds.has(s.classId))
      .forEach((s) => {
        const studentRecs = filtered.filter((r) => r.studentId === s.id);
        const present = studentRecs.filter((r) => r.status === "present").length;
        const late = studentRecs.filter((r) => r.status === "late").length;
        const absent = studentRecs.filter((r) => r.status === "absent").length;
        rows.push({
          student: s,
          className: classMap.get(s.classId)?.name ?? "—",
          present,
          late,
          absent,
          total: studentRecs.length,
          percent: calculateAttendancePercent(filtered, s.id),
        });
      });

    return rows.sort((a, b) => b.percent - a.percent);
  }, [data, filtered, classFilter]);

  const visibleRows = useMemo(() => {
    if (!search.trim()) return studentRows;
    const q = search.toLowerCase();
    return studentRows.filter(
      (r) =>
        r.student.name.toLowerCase().includes(q) ||
        r.student.rollNo.toLowerCase().includes(q)
    );
  }, [studentRows, search]);

  const summary = useMemo(() => {
    const totals = visibleRows.reduce(
      (acc, r) => {
        acc.present += r.present;
        acc.late += r.late;
        acc.absent += r.absent;
        acc.total += r.total;
        return acc;
      },
      { present: 0, late: 0, absent: 0, total: 0 }
    );
    const pct = (n: number) =>
      totals.total === 0 ? 0 : Math.round((n / totals.total) * 100);
    return {
      ...totals,
      presentPct: pct(totals.present),
      latePct: pct(totals.late),
      absentPct: pct(totals.absent),
    };
  }, [visibleRows]);

  const trend = useMemo(() => {
    if (!filtered) return [];
    const days = Math.max(
      1,
      Math.min(
        90,
        Math.round(
          (new Date(to).getTime() - new Date(from).getTime()) / 86400000
        ) + 1
      )
    );
    return getWeeklyTrend(filtered, days).map((t) => ({
      ...t,
      label: new Date(t.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [filtered, from, to]);

  if (loading) {
    return <TableSkeleton rows={8} />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={UserX}
        title="Sign in as teacher"
        description="Please log in with a teacher account to view reports."
      />
    );
  }

  if (data.myClasses.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No classes assigned"
        description="You need at least one assigned class to generate reports."
      />
    );
  }

  const minPercent = data.settings.minAttendancePercent;
  const defaulters = visibleRows.filter((r) => r.percent < minPercent);

  const handleExport = () => {
    if (visibleRows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(
      `teacher-report-${classFilter}-${getTodayString()}.csv`,
      ["Name", "Roll No", "Class", "Present", "Late", "Absent", "Total", "Percent"],
      visibleRows.map((r) => [
        r.student.name,
        r.student.rollNo,
        r.className,
        String(r.present),
        String(r.late),
        String(r.absent),
        String(r.total),
        `${r.percent}%`,
      ])
    );
    toast.success("CSV downloaded");
  };

  const handleExportDefaulters = () => {
    if (defaulters.length === 0) {
      toast("No defaulters to export", { icon: "🎉" });
      return;
    }
    downloadCsv(
      `defaulters-${classFilter}-${getTodayString()}.csv`,
      ["Name", "Roll No", "Class", "Percent", "Sessions"],
      defaulters.map((r) => [
        r.student.name,
        r.student.rollNo,
        r.className,
        `${r.percent}%`,
        String(r.total),
      ])
    );
    toast.success("Defaulters exported");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 print:space-y-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            My Reports
          </h2>
          <p className="text-sm text-slate-400">
            Reports are limited to your assigned classes.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 print:hidden">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Class</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="all">All my classes</option>
            {data.myClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="relative">
          <label className="mb-1 block text-xs text-slate-500">Search</label>
          <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or roll no"
            className="rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Records",
            value: summary.total,
            color: "text-white",
          },
          {
            label: "Present %",
            value: `${summary.presentPct}%`,
            color: "text-green-400",
          },
          {
            label: "Late %",
            value: `${summary.latePct}%`,
            color: "text-amber-400",
          },
          {
            label: "Absent %",
            value: `${summary.absentPct}%`,
            color: "text-red-400",
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className={cn("mt-2 font-display text-3xl font-bold", s.color)}>
              {s.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          Attendance Trend
        </h3>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No data for selected range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="teacherTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CHART_THEME.present}
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_THEME.present}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_THEME.tick, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: CHART_THEME.tick, fontSize: 11 }}
              />
              <RechartsTooltip content={<GlassTooltip />} />
              <Area
                type="monotone"
                dataKey="percent"
                name="Attendance %"
                stroke={CHART_THEME.present}
                fill="url(#teacherTrend)"
                {...CHART_ANIMATION}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          Student Attendance{" "}
          <span className="text-sm font-normal text-slate-500">
            ({visibleRows.length})
          </span>
        </h3>
        {visibleRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No students match.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Roll</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4 text-right">Present</th>
                  <th className="py-2 pr-4 text-right">Late</th>
                  <th className="py-2 pr-4 text-right">Absent</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <motion.tr
                    key={r.student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="border-b border-white/5 text-slate-300"
                  >
                    <td className="py-2 pr-4 text-white">{r.student.name}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      {r.student.rollNo}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{r.className}</td>
                    <td className="py-2 pr-4 text-right text-green-300">
                      {r.present}
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-300">
                      {r.late}
                    </td>
                    <td className="py-2 pr-4 text-right text-red-300">
                      {r.absent}
                    </td>
                    <td className="py-2 pr-4 text-right">{r.total}</td>
                    <td
                      className={cn(
                        "py-2 text-right font-semibold",
                        r.percent >= minPercent
                          ? "text-green-300"
                          : r.percent >= 60
                            ? "text-amber-300"
                            : "text-red-300"
                      )}
                    >
                      {r.percent}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-white">
            Defaulters{" "}
            <span className="text-sm font-normal text-amber-300">
              (below {minPercent}%)
            </span>
          </h3>
          <button
            type="button"
            onClick={handleExportDefaulters}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" />
            Export defaulters
          </button>
        </div>
        {defaulters.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No defaulters in this period.
          </p>
        ) : (
          <ul className="space-y-2">
            {defaulters.map((r) => (
              <li
                key={r.student.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-white">{r.student.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.student.rollNo} · {r.className}
                  </p>
                </div>
                <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                  {r.percent}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="hidden text-xs text-slate-500 print:block">
        Report generated on {formatDate(new Date())} ·{" "}
        {data.teacher.name} · {data.settings.schoolName}
      </p>
    </motion.div>
  );
}
