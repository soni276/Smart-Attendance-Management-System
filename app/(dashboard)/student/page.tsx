"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, Download } from "lucide-react";
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
  Course,
  Faculty,
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
  subjects: Map<string, string>,
  courses: Map<string, Course>
) {
  const header = "Date,Course,Subject,Status,Marked At,Method\n";
  const rows = records
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      const c = courses.get(r.courseId);
      const courseLabel = c ? `${c.courseCode} ${c.courseName}` : r.courseId;
      return `${r.date},"${courseLabel}","${subjects.get(r.subjectId) ?? r.subjectId}",${r.status},${r.markedAt},${r.method}`;
    });
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${student.enrollmentNo}-${getTodayString()}.csv`;
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

    const allCourses = getAll<Course>(KEYS.COURSES);
    const myCourses = allCourses.filter((c) =>
      student.courseIds.includes(c.id)
    );
    const faculty = getAll<Faculty>(KEYS.FACULTY);
    const settings = getSettings();
    const allRecords = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const myRecords = allRecords.filter((r) => r.studentId === student.id);
    const percent = calculateAttendancePercent(allRecords, student.id);
    const trend = getStudentTrend(allRecords, student.id, 30);

    const subjectMap = new Map<string, string>();
    allCourses.forEach((c) =>
      c.schedule.forEach((s) => subjectMap.set(s.subjectId, s.subject))
    );

    const courseMap = new Map(allCourses.map((c) => [c.id, c]));

    const courseStats = myCourses.map((course) => {
      const courseRecs = myRecords.filter((r) => r.courseId === course.id);
      const attended = courseRecs.filter(
        (r) =>
          r.status === "present" ||
          r.status === "late" ||
          r.status === "half-day"
      ).length;
      const pct =
        courseRecs.length === 0
          ? 0
          : Math.round((attended / courseRecs.length) * 100);
      const fac = faculty.find((f) => f.id === course.facultyId);
      return {
        course,
        faculty: fac,
        attended,
        total: courseRecs.length,
        percent: pct,
      };
    });

    const dow = new Date().getDay();
    const todayName = dow >= 1 && dow <= 6 ? WEEKDAYS[dow - 1] : null;
    const upcoming = todayName
      ? myCourses
          .flatMap((c) =>
            c.schedule
              .filter((s) => s.day === todayName)
              .map((slot) => ({
                courseCode: c.courseCode,
                courseName: c.courseName,
                subject: slot.subject,
                startTime: slot.startTime,
                endTime: slot.endTime,
                room: slot.room,
                facultyName:
                  faculty.find((f) => f.id === c.facultyId)?.name ?? "Faculty",
              }))
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      : [];

    const heatmapDays = trend.map((t) => ({
      date: t.date,
      percent: t.percent,
      label: formatDate(t.date),
    }));

    const recent = [...myRecords]
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.markedAt.localeCompare(a.markedAt)
      )
      .slice(0, 20);

    return {
      student,
      myCourses,
      settings,
      percent,
      courseStats,
      upcoming,
      heatmapDays,
      recent,
      subjectMap,
      courseMap,
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
    settings,
    percent,
    courseStats,
    upcoming,
    heatmapDays,
    recent,
    subjectMap,
    courseMap,
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
          <p className="text-slate-300">{student.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-indigo-200">
              {student.enrollmentNo}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
              {student.department}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
              {student.semester} Semester
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
              Batch {student.batch}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadStudentCsv(student, myRecords, subjectMap, courseMap)
          }
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
        >
          <Download className="h-4 w-4" />
          Download My Report
        </button>
      </div>

      {belowThreshold && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              Your attendance is {percent}% — below the required threshold.
            </p>
            <p className="mt-1 text-xs text-amber-300/80">
              As per university norms, minimum {settings.minAttendancePercent}%
              attendance is mandatory.
            </p>
          </div>
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
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
            <BookOpen className="h-5 w-5 text-indigo-300" />
            My Courses
          </h3>
          <div className="space-y-4">
            {courseStats.map((stat) => (
              <div key={stat.course.id}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <div>
                    <span className="font-mono text-xs text-indigo-300">
                      {stat.course.courseCode}
                    </span>
                    <span className="ml-2 text-slate-200">
                      {stat.course.courseName}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      · {stat.course.credits} credits ·{" "}
                      {stat.faculty?.name ?? "Faculty"}
                    </span>
                  </div>
                  <span
                    className={
                      stat.percent >= settings.minAttendancePercent
                        ? "text-green-300"
                        : stat.percent >= 60
                          ? "text-amber-300"
                          : "text-red-300"
                    }
                  >
                    {stat.percent}%{" "}
                    <span className="text-slate-500">
                      ({stat.attended}/{stat.total})
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.percent}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            ))}
            {courseStats.length === 0 && (
              <p className="text-slate-500">
                You are not enrolled in any course yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <CalendarHeatmap days={heatmapDays} title="Last 30 Days" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-white">
            Today&apos;s Lectures
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-slate-500">No lectures scheduled today.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((slot, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">
                      <span className="font-mono text-xs text-indigo-300">
                        {slot.courseCode}
                      </span>{" "}
                      {slot.subject}
                    </p>
                    <p className="text-xs text-slate-400">
                      {slot.facultyName} · Room {slot.room ?? "—"}
                    </p>
                  </div>
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
                  <th className="py-2 pr-3">Course / Subject</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const course = courseMap.get(r.courseId);
                  return (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-400">
                        {formatDate(r.date)}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {course && (
                          <span className="block font-mono text-[11px] text-indigo-300">
                            {course.courseCode}
                          </span>
                        )}
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
                  );
                })}
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
