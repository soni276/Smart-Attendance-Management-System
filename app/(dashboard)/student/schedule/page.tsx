"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { KEYS, getAll, getCurrentUser } from "@/lib/storage";
import { calculateAttendancePercent, cn } from "@/lib/utils";
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

const SUBJECT_COLORS = [
  "from-indigo-500/30 to-indigo-700/20 border-indigo-500/30 text-indigo-200",
  "from-purple-500/30 to-purple-700/20 border-purple-500/30 text-purple-200",
  "from-pink-500/30 to-rose-700/20 border-pink-500/30 text-pink-200",
  "from-cyan-500/30 to-blue-700/20 border-cyan-500/30 text-cyan-200",
  "from-emerald-500/30 to-teal-700/20 border-emerald-500/30 text-emerald-200",
  "from-amber-500/30 to-orange-700/20 border-amber-500/30 text-amber-200",
  "from-fuchsia-500/30 to-violet-700/20 border-fuchsia-500/30 text-fuchsia-200",
];

interface EnrichedSlot extends ScheduleSlot {
  course: Course;
  faculty: Faculty | null;
}

function getCurrentDayName(): ScheduleSlot["day"] | null {
  const idx = new Date().getDay();
  if (idx === 0) return null;
  return WEEKDAYS[idx - 1];
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function colorForSubject(subjectId: string): string {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash = (hash * 31 + subjectId.charCodeAt(i)) | 0;
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function useNow(intervalMs = 1000): Date | null {
  // Returns null on first render (SSR + hydration) and a real Date afterwards.
  // This avoids React #418 hydration mismatch errors.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

interface SubjectAttendance {
  attended: number;
  total: number;
  percent: number;
}

function buildSubjectStats(
  records: AttendanceRecord[]
): Map<string, SubjectAttendance> {
  const map = new Map<string, SubjectAttendance>();
  records.forEach((r) => {
    const entry = map.get(r.subjectId) ?? { attended: 0, total: 0, percent: 0 };
    entry.total += 1;
    if (
      r.status === "present" ||
      r.status === "late" ||
      r.status === "half-day"
    ) {
      entry.attended += 1;
    }
    map.set(r.subjectId, entry);
  });
  map.forEach((v) => {
    v.percent = v.total === 0 ? 0 : Math.round((v.attended / v.total) * 100);
  });
  return map;
}

export default function StudentTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [refreshKey] = useState(0);
  const now = useNow(1000);

  const data = useMemo(() => {
    void refreshKey;
    if (typeof window === "undefined") return null;

    const user = getCurrentUser();
    if (!user || user.role !== "student") return null;

    const students = getAll<Student>(KEYS.STUDENTS);
    const student =
      students.find((s) => s.id === user.userId) ??
      students.find((s) => s.email === user.email);
    if (!student) return null;

    const allCourses = getAll<Course>(KEYS.COURSES);
    const myCourses = allCourses.filter((c) =>
      student.courseIds.includes(c.id)
    );
    const allFaculty = getAll<Faculty>(KEYS.FACULTY);

    const records = getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter(
      (r) => r.studentId === student.id
    );
    const subjectStats = buildSubjectStats(records);
    const overall = calculateAttendancePercent(
      getAll<AttendanceRecord>(KEYS.ATTENDANCE),
      student.id
    );

    const allSlots: EnrichedSlot[] = myCourses.flatMap((course) =>
      course.schedule.map((slot) => ({
        ...slot,
        course,
        faculty:
          allFaculty.find((f) => f.id === course.facultyId) ?? null,
      }))
    );

    return { student, myCourses, allFaculty, subjectStats, overall, allSlots };
  }, [refreshKey]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const todayDay = getCurrentDayName();

  const todaySlots = useMemo(() => {
    if (!data || !todayDay) return [];
    return data.allSlots
      .filter((s) => s.day === todayDay)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [data, todayDay]);

  const nextLecture = useMemo(() => {
    if (!now || todaySlots.length === 0) return null;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return (
      todaySlots.find((s) => timeToMinutes(s.startTime) > nowMins) ?? null
    );
  }, [todaySlots, now]);

  const countdown = useMemo(() => {
    if (!now || !nextLecture) return null;
    const target = new Date(now);
    const [h, m] = nextLecture.startTime.split(":").map(Number);
    target.setHours(h, m, 0, 0);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const totalSec = Math.floor(diffMs / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return { hh, mm, ss };
  }, [nextLecture, now]);

  if (loading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={2} />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Timetable unavailable"
        description="Please log in as a student to view your timetable."
      />
    );
  }

  if (data.myCourses.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No courses enrolled"
        description="You are not enrolled in any course yet. Contact your administrator."
      />
    );
  }

  const grid = buildTimetableGrid(data.allSlots);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          My Timetable
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {data.student.department} · {data.student.semester} Semester · Batch{" "}
          {data.student.batch}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-5 lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <CalendarDays className="h-5 w-5 text-indigo-400" />
              Today&apos;s Lectures
              {todayDay && (
                <span className="text-sm font-normal text-slate-400">
                  · {todayDay}
                </span>
              )}
            </h3>
            <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200">
              {todaySlots.length}{" "}
              {todaySlots.length === 1 ? "lecture" : "lectures"}
            </span>
          </div>
          {todaySlots.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No lectures scheduled for today.
            </p>
          ) : (
            <ul className="space-y-3">
              {todaySlots.map((slot, i) => {
                const stats = data.subjectStats.get(slot.subjectId);
                const color = colorForSubject(slot.subjectId);
                const nowMins = now
                  ? now.getHours() * 60 + now.getMinutes()
                  : -1;
                const startMins = timeToMinutes(slot.startTime);
                const endMins = timeToMinutes(slot.endTime);
                const isLive =
                  nowMins >= 0 && nowMins >= startMins && nowMins < endMins;
                const isPast = nowMins >= 0 && nowMins >= endMins;
                return (
                  <motion.li
                    key={`${slot.subjectId}-${i}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className={cn(
                      "flex flex-wrap items-center gap-4 rounded-xl border bg-gradient-to-r p-4",
                      color,
                      isPast && "opacity-50"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base font-bold">
                        {slot.course.courseCode.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          <span className="font-mono text-xs text-white/70">
                            {slot.course.courseCode}
                          </span>{" "}
                          {slot.subject}
                        </p>
                        <p className="truncate text-xs text-slate-300/80">
                          {slot.faculty?.name ?? "Faculty"} · Room{" "}
                          {slot.room ?? "—"} · {slot.course.credits} credits
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-slate-300/70" />
                      <span className="text-slate-200">
                        {formatTimeLabel(slot.startTime)} –{" "}
                        {formatTimeLabel(slot.endTime)}
                      </span>
                    </div>
                    {stats && stats.total > 0 && (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                        {stats.percent}%
                      </span>
                    )}
                    {isLive && (
                      <span className="flex items-center gap-1 rounded-full bg-green-500/30 px-2 py-0.5 text-xs font-medium text-green-100">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-300" />
                        Live
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5"
        >
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Next Lecture
          </h3>
          {nextLecture && countdown ? (
            <div className="text-center">
              <p className="font-mono text-xs text-indigo-300">
                {nextLecture.course.courseCode}
              </p>
              <p className="font-medium text-white">{nextLecture.subject}</p>
              <p className="mt-1 text-xs text-slate-400">
                {nextLecture.faculty?.name ?? "Faculty"} · Room{" "}
                {nextLecture.room ?? "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Starts at {formatTimeLabel(nextLecture.startTime)}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { v: countdown.hh, l: "Hrs" },
                  { v: countdown.mm, l: "Min" },
                  { v: countdown.ss, l: "Sec" },
                ].map((b) => (
                  <div
                    key={b.l}
                    className="rounded-xl border border-white/10 bg-white/[0.04] py-3"
                  >
                    <p className="font-display text-2xl font-bold text-indigo-300 tabular-nums">
                      {String(b.v).padStart(2, "0")}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {b.l}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">
              <Clock className="mx-auto mb-2 h-8 w-8 text-slate-600" />
              {todaySlots.length === 0
                ? "No lectures today."
                : "All lectures done for today."}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">
            Weekly Timetable
          </h3>
          <span className="hidden text-xs text-slate-500 sm:inline">
            Highlighted column = today
          </span>
        </div>

        {grid.timeRanges.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No timetable yet"
            description="Your enrolled courses don't have any scheduled slots."
            className="py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-[110px] px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Time
                  </th>
                  {WEEKDAYS.map((day) => {
                    const isToday = day === todayDay;
                    return (
                      <th
                        key={day}
                        className={cn(
                          "rounded-lg px-3 py-2 text-xs font-semibold",
                          isToday
                            ? "border border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                            : "text-slate-400"
                        )}
                      >
                        {day}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grid.timeRanges.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="rounded-lg bg-white/[0.02] px-3 py-3 text-xs text-slate-400">
                      {label}
                    </td>
                    {WEEKDAYS.map((day) => {
                      const slot = grid.lookup.get(`${day}_${key}`);
                      const isToday = day === todayDay;
                      if (!slot) {
                        return (
                          <td
                            key={day}
                            className={cn(
                              "rounded-lg border border-dashed border-white/5 px-3 py-3 text-center text-xs text-slate-700",
                              isToday && "border-indigo-500/20 bg-indigo-500/5"
                            )}
                          >
                            —
                          </td>
                        );
                      }
                      const color = colorForSubject(slot.subjectId);
                      const stats = data.subjectStats.get(slot.subjectId);
                      return (
                        <td
                          key={day}
                          className={cn(
                            "rounded-lg border bg-gradient-to-br p-2 align-top",
                            color,
                            isToday && "ring-1 ring-indigo-400/40"
                          )}
                        >
                          <p className="truncate font-mono text-[10px] text-white/70">
                            {slot.course.courseCode}
                          </p>
                          <p className="truncate text-sm font-semibold text-white">
                            {slot.subject}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-200/70">
                            {slot.faculty?.name?.split(" ").slice(-1)[0] ?? ""}
                            {slot.room ? ` · ${slot.room}` : ""}
                          </p>
                          {stats && stats.total > 0 && (
                            <p className="mt-1 text-[10px] font-medium text-white/80">
                              {stats.percent}%
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

interface TimetableGrid {
  timeRanges: { key: string; label: string }[];
  lookup: Map<string, EnrichedSlot>;
}

function buildTimetableGrid(slots: EnrichedSlot[]): TimetableGrid {
  const ranges = new Map<string, string>();
  const lookup = new Map<string, EnrichedSlot>();
  slots.forEach((s) => {
    const key = `${s.startTime}-${s.endTime}`;
    ranges.set(
      key,
      `${formatTimeLabel(s.startTime)} – ${formatTimeLabel(s.endTime)}`
    );
    lookup.set(`${s.day}_${key}`, s);
  });
  const timeRanges = [...ranges.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort(
      (a, b) =>
        timeToMinutes(a.key.split("-")[0]) -
        timeToMinutes(b.key.split("-")[0])
    );
  return { timeRanges, lookup };
}
