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
  ClassRoom,
  QRSession,
  ScheduleSlot,
  Student,
  Teacher,
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

export default function TeacherDashboardPage() {
  const data = useMemo(() => {
    const user = getCurrentUser();
    const today = getTodayString();
    const dayName = getCurrentDayName();
    const teachers = getAll<Teacher>(KEYS.TEACHERS);
    const classes = getAll<ClassRoom>(KEYS.CLASSES);
    const students = getAll<Student>(KEYS.STUDENTS);
    const attendance = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const qrSessions = getAll<QRSession>(KEYS.QR_SESSIONS);
    const settings = getSettings();

    const teacher =
      teachers.find((t) => t.id === user?.userId) ??
      teachers.find((t) => t.email === user?.email);

    const myClasses = teacher
      ? classes.filter((c) => teacher.classIds.includes(c.id))
      : [];

    const todayClasses = dayName
      ? myClasses
          .map((cls) => {
            const slots = cls.schedule.filter((s) => s.day === dayName);
            return slots.map((slot) => ({
              classId: cls.id,
              className: cls.name,
              section: cls.section,
              subject: slot.subject,
              subjectId: slot.subjectId,
              startTime: slot.startTime,
              endTime: slot.endTime,
              studentCount: cls.studentIds.length,
            }));
          })
          .flat()
      : [];

    const todayRecords = attendance.filter((r) => r.date === today);
    const myClassIds = new Set(myClasses.map((c) => c.id));
    const myTodayRecords = todayRecords.filter((r) =>
      myClassIds.has(r.classId)
    );

    const markedToday = new Set(
      myTodayRecords
        .filter((r) => r.status === "present" || r.status === "late")
        .map((r) => r.studentId)
    ).size;

    const totalStudents = myClasses.reduce(
      (sum, c) => sum + c.studentIds.length,
      0
    );

    const activeSessions = qrSessions.filter(
      (s) => s.isActive && teacher && s.teacherId === teacher.id
    );

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const classMap = new Map(classes.map((c) => [c.id, c]));

    const recentActivity = [...myTodayRecords]
      .sort(
        (a, b) =>
          new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
      )
      .slice(0, 12)
      .map((r) => {
        const student = studentMap.get(r.studentId);
        const cls = classMap.get(r.classId);
        const subject =
          cls?.schedule.find((s) => s.subjectId === r.subjectId)?.subject ??
          "—";
        return {
          ...r,
          studentName: student?.name ?? "Unknown",
          className: cls?.name ?? "—",
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

    return {
      teacher,
      todayClasses,
      recentActivity,
      activeSessions,
      stats: {
        classes: myClasses.length,
        students: totalStudents,
        rate,
        activeQr: activeSessions.length,
        presentCount,
        lateCount,
        absentCount,
      },
      settings,
    };
  }, []);

  if (!data.teacher) {
    return (
      <EmptyState
        icon={UserX}
        title="Teacher profile not found"
        description="Your account is not linked to a teacher record."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          Welcome, {data.teacher.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-slate-500">
          {getTodayString()} · {data.settings.schoolName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="My Classes"
          value={data.stats.classes}
          subtitle="Assigned to you"
          icon={BookOpen}
          gradient="from-indigo-500 to-indigo-700"
          delay={0}
        />
        <StatsCard
          title="My Students"
          value={data.stats.students}
          subtitle="Across all classes"
          icon={Users}
          gradient="from-cyan-500 to-blue-600"
          delay={0.08}
        />
        <StatsCard
          title="Today's Rate"
          value={data.stats.rate}
          suffix="%"
          subtitle="Present or late today"
          icon={UserCheck}
          gradient="from-emerald-500 to-teal-600"
          delay={0.16}
        />
        <StatsCard
          title="Active QR"
          value={data.stats.activeQr}
          subtitle="Live sessions now"
          icon={QrCode}
          gradient="from-purple-500 to-violet-700"
          delay={0.24}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">
              Today&apos;s Classes
            </h3>
            <Link
              href="/teacher/mark-attendance"
              className="flex items-center gap-1 rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Mark attendance
            </Link>
          </div>
          {data.todayClasses.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No classes scheduled for today
            </p>
          ) : (
            <div className="space-y-3">
              {data.todayClasses.map((slot, i) => (
                <motion.div
                  key={`${slot.classId}-${slot.subjectId}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div>
                    <p className="font-medium text-white">
                      {slot.className} — {slot.section}
                    </p>
                    <p className="text-sm text-slate-400">{slot.subject}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {slot.startTime} – {slot.endTime} · {slot.studentCount}{" "}
                      students
                    </p>
                  </div>
                  <Link
                    href={`/teacher/mark-attendance?classId=${slot.classId}&subjectId=${slot.subjectId}`}
                    className="shrink-0 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20"
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
                  <span className="text-white">{s.className}</span>
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
                    {item.studentName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.className} · {item.subject}
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
