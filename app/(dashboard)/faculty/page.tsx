"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  ClipboardCheck,
  QrCode,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  KEYS,
  getAll,
  getCurrentUser,
  getSettings,
} from "@/lib/storage";
import {
  formatTime,
  getStatusColor,
  getTodayString,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  Course,
  Faculty,
  QRSession,
  ScheduleSlot,
  Student,
} from "@/types";

function getCurrentDayName(): ScheduleSlot["day"] | null {
  const idx = new Date().getDay();
  if (idx === 0) return null;
  const names: ScheduleSlot["day"][] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[idx - 1];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function FacultyDashboardPage() {
  const data = useMemo(() => {
    const user = getCurrentUser();
    const today = getTodayString();
    const dayName = getCurrentDayName();
    const allFaculty = getAll<Faculty>(KEYS.FACULTY);
    const courses = getAll<Course>(KEYS.COURSES);
    const students = getAll<Student>(KEYS.STUDENTS);
    const attendance = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const qrSessions = getAll<QRSession>(KEYS.QR_SESSIONS);
    const settings = getSettings();

    const faculty =
      allFaculty.find((f) => f.id === user?.userId) ??
      allFaculty.find((f) => f.email === user?.email);

    const myCourses = faculty
      ? courses.filter(
          (c) =>
            faculty.courseIds.includes(c.id) || c.facultyId === faculty.id
        )
      : [];

    const todayLectures = dayName
      ? myCourses
          .map((course) => {
            const slots = course.schedule.filter((s) => s.day === dayName);
            return slots.map((slot) => ({
              courseId: course.id,
              courseName: course.courseName,
              courseCode: course.courseCode,
              department: course.department,
              semester: course.semester,
              batch: course.batch,
              subject: slot.subject,
              subjectId: slot.subjectId,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.room ?? "—",
              studentCount: course.studentIds.length,
            }));
          })
          .flat()
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      : [];

    const todayRecords = attendance.filter((r) => r.date === today);
    const myCourseIds = new Set(myCourses.map((c) => c.id));
    const myTodayRecords = todayRecords.filter((r) =>
      myCourseIds.has(r.courseId)
    );

    const markedToday = new Set(
      myTodayRecords
        .filter((r) => r.status === "present" || r.status === "late")
        .map((r) => r.studentId)
    ).size;

    const totalStudents = new Set(
      myCourses.flatMap((c) => c.studentIds)
    ).size;

    const activeSessions = qrSessions.filter(
      (s) => s.isActive && faculty && s.facultyId === faculty.id
    );

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const recentActivity = [...myTodayRecords]
      .sort(
        (a, b) =>
          new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
      )
      .slice(0, 12)
      .map((r) => {
        const student = studentMap.get(r.studentId);
        const course = courseMap.get(r.courseId);
        const subject =
          course?.schedule.find((s) => s.subjectId === r.subjectId)?.subject ??
          "—";
        return {
          ...r,
          studentName: student?.name ?? "Unknown",
          enrollmentNo: student?.enrollmentNo ?? "—",
          courseLabel: course
            ? `${course.courseCode} · ${course.courseName}`
            : "—",
          subject,
        };
      });

    const presentCount = myTodayRecords.filter(
      (r) => r.status === "present"
    ).length;
    const lateCount = myTodayRecords.filter((r) => r.status === "late").length;
    const absentCount = myTodayRecords.filter(
      (r) => r.status === "absent"
    ).length;

    const rate =
      totalStudents === 0
        ? 0
        : Math.round((markedToday / totalStudents) * 100);

    const pendingSessions = todayLectures.filter((slot) => {
      return !myTodayRecords.some(
        (r) => r.courseId === slot.courseId && r.subjectId === slot.subjectId
      );
    }).length;

    return {
      faculty,
      todayLectures,
      recentActivity,
      activeSessions,
      stats: {
        courses: myCourses.length,
        students: totalStudents,
        rate,
        activeQr: activeSessions.length,
        pendingSessions,
        presentCount,
        lateCount,
        absentCount,
      },
      settings,
    };
  }, []);

  if (!data.faculty) {
    return (
      <EmptyState
        icon={UserX}
        title="Faculty profile not found"
        description="Your account is not linked to a faculty record."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          Welcome, {data.faculty.name.split(" ").slice(0, 2).join(" ")}
        </h2>
        <p className="text-sm text-slate-400">
          {data.faculty.designation} · {data.faculty.department} ·{" "}
          <span className="font-mono text-xs text-indigo-300">
            {data.faculty.employeeId}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {getTodayString()} · {data.settings.institutionName} ·{" "}
          {data.settings.semesterName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="My Courses"
          value={data.stats.courses}
          subtitle="Assigned to you"
          icon={BookOpen}
          gradient="from-indigo-500 to-indigo-700"
          delay={0}
        />
        <StatsCard
          title="Total Students I Teach"
          value={data.stats.students}
          subtitle="Across all courses"
          icon={Users}
          gradient="from-cyan-500 to-blue-600"
          delay={0.08}
        />
        <StatsCard
          title="Today's Avg Attendance"
          value={data.stats.rate}
          suffix="%"
          subtitle="Present or late today"
          icon={UserCheck}
          gradient="from-emerald-500 to-teal-600"
          delay={0.16}
        />
        <StatsCard
          title="Pending Sessions"
          value={data.stats.pendingSessions}
          subtitle={`${data.stats.activeQr} live · today`}
          icon={QrCode}
          gradient="from-purple-500 to-violet-700"
          delay={0.24}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">
              My Courses Today
            </h3>
            <Link
              href="/faculty/mark-attendance"
              className="flex items-center gap-1 rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Take Attendance
            </Link>
          </div>
          {data.todayLectures.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No lectures scheduled for today
            </p>
          ) : (
            <div className="space-y-3">
              {data.todayLectures.map((slot, i) => (
                <motion.div
                  key={`${slot.courseId}-${slot.subjectId}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">
                      <span className="font-mono text-indigo-300">
                        {slot.courseCode}
                      </span>{" "}
                      · {slot.courseName}
                    </p>
                    <p className="text-sm text-slate-400">{slot.subject}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {slot.startTime} – {slot.endTime} · Room {slot.room} ·{" "}
                      {slot.studentCount} students
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {slot.semester} Sem · Batch {slot.batch}
                    </p>
                  </div>
                  <Link
                    href={`/faculty/mark-attendance?courseId=${slot.courseId}&subjectId=${slot.subjectId}`}
                    className="ml-3 shrink-0 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20"
                  >
                    <QrCode className="mb-1 h-4 w-4" />
                    Start QR
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-white">
            Today&apos;s Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Present", value: data.stats.presentCount, color: "text-green-400" },
              { label: "Late", value: data.stats.lateCount, color: "text-yellow-400" },
              { label: "Absent", value: data.stats.absentCount, color: "text-red-400" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
              >
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
          {data.activeSessions.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Live sessions
              </p>
              {data.activeSessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-indigo-300">
                    {s.courseCode}
                  </span>
                  <span className="text-slate-400"> · {s.subject}</span>
                  <span className="ml-2 text-xs text-indigo-300">
                    {s.markedStudentIds.length} marked
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          Recent Attendance
        </h3>
        {data.recentActivity.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No attendance marked today
          </p>
        ) : (
          <div className="space-y-2">
            {data.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                  {getInitials(item.studentName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {item.studentName}{" "}
                    <span className="font-mono text-[11px] text-slate-500">
                      {item.enrollmentNo}
                    </span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.courseLabel} · {item.subject}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${getStatusColor(item.status)}`}
                >
                  {item.status}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatTime(item.markedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
