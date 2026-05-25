"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Download } from "lucide-react";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { getStudentTrend } from "@/lib/analytics";
import { getSession } from "@/lib/auth";
import { KEYS, getAll, getSettings } from "@/lib/storage";
import {
  calculateAttendancePercent,
  formatDate,
  formatTime,
  getStatusColor,
  getTodayString,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  ScheduleSlot,
  Student,
} from "@/types";

const WEEKDAYS: ScheduleSlot["day"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function CircularProgress({ percent }: { percent: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#progressGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-white">
          {percent}%
        </span>
        <span className="text-xs text-slate-500">Overall</span>
      </div>
    </div>
  );
}

function downloadStudentCsv(
  student: Student,
  records: AttendanceRecord[],
  subjects: Map<string, string>
) {
  const header = "Date,Subject,Status,Marked At,Method\n";
  const rows = records
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (r) =>
        `${r.date},"${subjects.get(r.subjectId) ?? r.subjectId}",${r.status},${r.markedAt},${r.method}`
    );
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${student.rollNo}-${getTodayString()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentDashboardPage() {
  const session = getSession();

  const data = useMemo(() => {
    if (!session || session.role !== "student") {
      return null;
    }

    const student = getAll<Student>(KEYS.STUDENTS).find(
      (s) => s.id === session.userId
    );
    if (!student) return null;

    const classes = getAll<ClassRoom>(KEYS.CLASSES);
    const classRoom = classes.find((c) => c.id === student.classId);
    const settings = getSettings();
    const allRecords = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const myRecords = allRecords.filter((r) => r.studentId === student.id);
    const percent = calculateAttendancePercent(allRecords, student.id);
    const trend = getStudentTrend(allRecords, student.id, 30);

    const subjectMap = new Map<string, string>();
    classes.forEach((c) =>
      c.schedule.forEach((s) => subjectMap.set(s.subjectId, s.subject))
    );

    const subjectStats = new Map<
      string,
      { name: string; attended: number; total: number }
    >();
    myRecords.forEach((r) => {
      const name = subjectMap.get(r.subjectId) ?? r.subjectId;
      const entry = subjectStats.get(r.subjectId) ?? {
        name,
        attended: 0,
        total: 0,
      };
      entry.total++;
      if (
        r.status === "present" ||
        r.status === "late" ||
        r.status === "half-day"
      ) {
        entry.attended++;
      }
      subjectStats.set(r.subjectId, entry);
    });

    const dow = new Date().getDay();
    const todayName = dow >= 1 && dow <= 6 ? WEEKDAYS[dow - 1] : null;
    const upcoming =
      todayName && classRoom
        ? classRoom.schedule.filter((s) => s.day === todayName)
        : [];

    const heatmapDays = trend.map((t) => ({
      date: t.date,
      percent: t.percent,
      label: formatDate(t.date),
    }));

    const recent = [...myRecords]
      .sort((a, b) => b.date.localeCompare(a.date) || b.markedAt.localeCompare(a.markedAt))
      .slice(0, 20);

    return {
      student,
      classRoom,
      settings,
      percent,
      subjectStats,
      upcoming,
      heatmapDays,
      recent,
      subjectMap,
      myRecords,
    };
  }, [session]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-slate-400">
        Please log in as a student to view your dashboard.
      </div>
    );
  }

  const {
    student,
    classRoom,
    settings,
    percent,
    subjectStats,
    upcoming,
    heatmapDays,
    recent,
    subjectMap,
    myRecords,
  } = data;

  const belowThreshold = percent < settings.minAttendancePercent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            My Attendance
          </h2>
          <p className="text-slate-400">
            {student.name} · {classRoom?.name ?? student.classId} ·{" "}
            {student.rollNo}
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadStudentCsv(student, myRecords, subjectMap)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
        >
          <Download className="h-4 w-4" />
          Download My Report
        </button>
      </div>

      {belowThreshold && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Your attendance is {percent}%, minimum required is{" "}
            {settings.minAttendancePercent}%
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 lg:col-span-1">
          <h3 className="mb-4 text-center text-sm font-medium text-slate-400">
            Overall Attendance
          </h3>
          <CircularProgress percent={percent} />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-semibold text-white">
            Subject-wise Breakdown
          </h3>
          <div className="space-y-4">
            {[...subjectStats.values()].map((sub) => {
              const pct =
                sub.total === 0 ? 0 : Math.round((sub.attended / sub.total) * 100);
              return (
                <div key={sub.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-300">{sub.name}</span>
                    <span className="text-slate-500">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              );
            })}
            {subjectStats.size === 0 && (
              <p className="text-slate-500">No attendance records yet.</p>
            )}
          </div>
        </div>
      </div>

      <CalendarHeatmap days={heatmapDays} title="Last 30 Days" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-white">
            Today&apos;s Classes
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-slate-500">No classes scheduled today.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((slot, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <span className="font-medium text-white">{slot.subject}</span>
                  <span className="text-sm text-slate-400">
                    {slot.startTime} – {slot.endTime}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 lg:col-span-1">
          <h3 className="mb-4 font-display text-lg font-semibold text-white">
            Recent Records
          </h3>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-slate-400">
                      {formatDate(r.date)}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">
                      {subjectMap.get(r.subjectId) ?? r.subjectId}
                    </td>
                    <td
                      className={`py-2 pr-3 capitalize ${getStatusColor(r.status)}`}
                    >
                      {r.status}
                    </td>
                    <td className="py-2 text-slate-500">
                      {formatTime(r.markedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recent.length === 0 && (
              <p className="py-6 text-center text-slate-500">No records yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
