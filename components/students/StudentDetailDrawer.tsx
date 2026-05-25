"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { getInitials, getStudentAttendancePercent } from "@/lib/student-helpers";
import { formatDate, formatTime, getStatusColor, getTodayString } from "@/lib/utils";
import type { AttendanceRecord, ClassRoom, Student } from "@/types";

interface StudentDetailDrawerProps {
  student: Student | null;
  classRoom: ClassRoom | null;
  records: AttendanceRecord[];
  onClose: () => void;
}

type Tab = "overview" | "calendar" | "records";

export function StudentDetailDrawer({
  student,
  classRoom,
  records,
  onClose,
}: StudentDetailDrawerProps) {
  const [tab, setTab] = useState<Tab>("overview");

  const studentRecords = useMemo(
    () => (student ? records.filter((r) => r.studentId === student.id) : []),
    [student, records]
  );

  const percent = student
    ? getStudentAttendancePercent(student.id, records)
    : 0;

  const subjectStats = useMemo(() => {
    if (!classRoom) return [];
    const subjects = new Map<string, string>();
    classRoom.schedule.forEach((s) => subjects.set(s.subjectId, s.subject));
    return Array.from(subjects.entries()).map(([subjectId, subject]) => {
      const subRecs = studentRecords.filter((r) => r.subjectId === subjectId);
      const p =
        subRecs.length === 0
          ? 0
          : Math.round(
              (subRecs.filter(
                (r) =>
                  r.status === "present" ||
                  r.status === "late" ||
                  r.status === "half-day"
              ).length /
                subRecs.length) *
                100
            );
      return { subject, percent: p };
    });
  }, [classRoom, studentRecords]);

  const heatmapDays = useMemo(() => {
    const days: { date: string; percent: number; label: string }[] = [];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${day}`;
      const dayRecs = studentRecords.filter((r) => r.date === dateStr);
      const total = dayRecs.length;
      const attended = dayRecs.filter(
        (r) =>
          r.status === "present" || r.status === "late" || r.status === "half-day"
      ).length;
      days.push({
        date: dateStr,
        percent: total ? Math.round((attended / total) * 100) : 0,
        label: formatDate(dateStr),
      });
    }
    return days;
  }, [studentRecords]);

  const streak = useMemo(() => {
    let s = 0;
    const today = getTodayString();
    const dates = [...new Set(studentRecords.map((r) => r.date))].sort().reverse();
    for (const date of dates) {
      if (date > today) continue;
      const dayRecs = studentRecords.filter((r) => r.date === date);
      const ok = dayRecs.some(
        (r) => r.status === "present" || r.status === "late"
      );
      if (ok) s++;
      else break;
    }
    return s;
  }, [studentRecords]);

  return (
    <AnimatePresence>
      {student && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-white/10 bg-slate-950 shadow-2xl"
          >
            <div className="border-b border-white/10 p-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4">
                {student.photoURL ? (
                  <img
                    src={student.photoURL}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-2xl font-bold">
                    {getInitials(student.name)}
                  </div>
                )}
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {student.name}
                  </h2>
                  <p className="text-slate-400">{student.rollNo}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                      {classRoom?.name ?? "—"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        student.isActive
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {student.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {(
                  [
                    ["overview", "Overview"],
                    ["calendar", "Calendar"],
                    ["records", "Records"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      tab === key
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-slate-500">Total attendance</p>
                      <p className="text-2xl font-bold text-white">{percent}%</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-slate-500">Present streak</p>
                      <p className="text-2xl font-bold text-white">{streak} days</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-400">
                      Subject-wise
                    </p>
                    {subjectStats.map((s) => (
                      <div key={s.subject} className="mb-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white">{s.subject}</span>
                          <span className="text-slate-400">{s.percent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "calendar" && (
                <CalendarHeatmap title="60-day attendance" days={heatmapDays} />
              )}

              {tab === "records" && (
                <div className="space-y-2">
                  {[...studentRecords]
                    .sort(
                      (a, b) =>
                        new Date(b.markedAt).getTime() -
                        new Date(a.markedAt).getTime()
                    )
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm"
                      >
                        <div>
                          <p className="text-white">{formatDate(r.date)}</p>
                          <p className="text-xs text-slate-500">
                            {formatTime(r.markedAt)} · {r.method}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs capitalize ${getStatusColor(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
