"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Search,
  TrendingDown,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { KEYS, getAll, getCurrentUser, getSettings } from "@/lib/storage";
import {
  calculateAttendancePercent,
  cn,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  ScheduleSlot,
  Student,
  Teacher,
} from "@/types";

const WEEKDAYS: ScheduleSlot["day"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function dayNameFromDate(d: Date): ScheduleSlot["day"] | null {
  const idx = d.getDay();
  if (idx === 0) return null;
  return WEEKDAYS[idx - 1];
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nextSlotLabel(schedule: ScheduleSlot[]): string {
  const today = dayNameFromDate(new Date());
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  if (today) {
    const upcoming = schedule
      .filter((s) => s.day === today)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .find((s) => timeToMinutes(s.startTime) >= nowMins);
    if (upcoming) {
      return `${upcoming.day} · ${upcoming.subject} · ${upcoming.startTime}`;
    }
  }
  const order = WEEKDAYS;
  const todayIdx = today ? order.indexOf(today) : -1;
  for (let offset = 1; offset <= 6; offset++) {
    const day = order[(todayIdx + offset) % 6];
    const slot = schedule
      .filter((s) => s.day === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];
    if (slot) return `${slot.day} · ${slot.subject} · ${slot.startTime}`;
  }
  return "No upcoming slots";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface ClassDetail {
  classroom: ClassRoom;
  studentCount: number;
  avgPercent: number;
  mySubjects: string[];
  nextSlot: string;
  students: {
    student: Student;
    percent: number;
  }[];
}

export default function TeacherMyClassesPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    const allStudents = getAll<Student>(KEYS.STUDENTS);
    const allRecords = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const settings = getSettings();

    const myClasses = classes.filter((c) => teacher.classIds.includes(c.id));
    const studentMap = new Map(allStudents.map((s) => [s.id, s]));

    const details: ClassDetail[] = myClasses.map((cls) => {
      const classRecs = allRecords.filter((r) => r.classId === cls.id);
      const studentRows = cls.studentIds
        .map((id) => studentMap.get(id))
        .filter((s): s is Student => !!s)
        .map((s) => ({
          student: s,
          percent: calculateAttendancePercent(classRecs, s.id),
        }))
        .sort((a, b) => b.percent - a.percent);

      const avg =
        studentRows.length === 0
          ? 0
          : Math.round(
              studentRows.reduce((sum, r) => sum + r.percent, 0) /
                studentRows.length
            );

      const mySubjects = Array.from(
        new Set(
          cls.schedule
            .filter((slot) =>
              teacher.subjects.some((sub) =>
                slot.subject.toLowerCase().includes(sub.toLowerCase())
              )
            )
            .map((s) => s.subject)
        )
      );

      return {
        classroom: cls,
        studentCount: cls.studentIds.length,
        avgPercent: avg,
        mySubjects: mySubjects.length > 0 ? mySubjects : teacher.subjects,
        nextSlot: nextSlotLabel(cls.schedule),
        students: studentRows,
      };
    });

    return { teacher, details, settings };
  }, []);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={1} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TableSkeleton rows={3} />
          <TableSkeleton rows={3} />
          <TableSkeleton rows={3} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Users}
        title="Sign in as teacher"
        description="Please log in with a teacher account to manage classes."
      />
    );
  }

  if (data.details.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No classes assigned"
        description="You haven't been assigned to any class yet. Ask an admin to assign you."
      />
    );
  }

  const minPercent = data.settings.minAttendancePercent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          My Classes
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {data.details.length}{" "}
          {data.details.length === 1 ? "class" : "classes"} assigned to you
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.details.map((d, i) => {
          const isOpen = expanded[d.classroom.id] ?? false;
          const q = (search[d.classroom.id] ?? "").toLowerCase();
          const visibleStudents = q
            ? d.students.filter(
                (row) =>
                  row.student.name.toLowerCase().includes(q) ||
                  row.student.rollNo.toLowerCase().includes(q)
              )
            : d.students;

          return (
            <motion.div
              key={d.classroom.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:border-indigo-500/30"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-white">
                    {d.classroom.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Section {d.classroom.section} · {d.classroom.department}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    d.avgPercent >= minPercent
                      ? "bg-green-500/15 text-green-300"
                      : d.avgPercent >= 60
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-red-500/15 text-red-300"
                  )}
                >
                  {d.avgPercent}%
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    Students
                  </p>
                  <p className="mt-1 font-display text-xl font-bold text-white">
                    {d.studentCount}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <BookOpen className="h-3.5 w-3.5" />
                    Subjects
                  </p>
                  <p
                    className="mt-1 truncate text-sm font-medium text-white"
                    title={d.mySubjects.join(", ")}
                  >
                    {d.mySubjects.slice(0, 2).join(", ") || "—"}
                    {d.mySubjects.length > 2 && ` +${d.mySubjects.length - 2}`}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Next: <span className="text-slate-300">{d.nextSlot}</span>
              </p>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/teacher/mark-attendance?classId=${d.classroom.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Mark Attendance
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [d.classroom.id]: !isOpen,
                    }))
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                  aria-expanded={isOpen}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                  Students
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-white/[0.06] pt-4">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          value={search[d.classroom.id] ?? ""}
                          onChange={(e) =>
                            setSearch((prev) => ({
                              ...prev,
                              [d.classroom.id]: e.target.value,
                            }))
                          }
                          placeholder="Search by name or roll…"
                          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none"
                        />
                      </div>
                      <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                        {visibleStudents.length === 0 ? (
                          <li className="py-4 text-center text-xs text-slate-500">
                            No students match
                          </li>
                        ) : (
                          visibleStudents.map((row) => (
                            <li
                              key={row.student.id}
                              className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white">
                                {getInitials(row.student.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-white">
                                  {row.student.name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {row.student.rollNo}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  row.percent >= minPercent
                                    ? "bg-green-500/10 text-green-300"
                                    : row.percent >= 60
                                      ? "bg-amber-500/10 text-amber-300"
                                      : "bg-red-500/10 text-red-300"
                                )}
                              >
                                {row.percent < minPercent && (
                                  <TrendingDown className="mr-0.5 inline h-3 w-3" />
                                )}
                                {row.percent}%
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
