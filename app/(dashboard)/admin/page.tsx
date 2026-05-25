"use client";

import dynamic from "next/dynamic";
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
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  QrCode,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { StatsCard } from "@/components/dashboard/StatsCard";
import {
  AttendanceChart,
  CHART_ANIMATION,
  CHART_THEME,
  GlassTooltip,
} from "@/components/charts/AttendanceChart";
const CalendarHeatmap = dynamic(
  () =>
    import("@/components/charts/CalendarHeatmap").then((m) => m.CalendarHeatmap),
  { ssr: false }
);
import {
  KEYS,
  getAll,
  getSettings,
} from "@/lib/storage";
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
  QRSession,
  Student,
} from "@/types";

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function trendPercent(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function todayAttendanceRate(
  records: AttendanceRecord[],
  date: string,
  totalStudents: number
): number {
  if (totalStudents === 0) return 0;
  const dayRecords = records.filter((r) => r.date === date);
  const marked = new Set(
    dayRecords
      .filter((r) => r.status === "present" || r.status === "late")
      .map((r) => r.studentId)
  );
  return Math.round((marked.size / totalStudents) * 100);
}

function countDefaulters(
  students: Student[],
  records: AttendanceRecord[],
  minPercent: number
): number {
  return students.filter(
    (s) =>
      s.isActive &&
      calculateAttendancePercent(records, s.id) < minPercent
  ).length;
}

const PIE_COLORS = [
  CHART_THEME.presentGreen,
  CHART_THEME.late,
  CHART_THEME.absent,
  CHART_THEME.halfDay,
];

export default function AdminDashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  // Initialize as null so SSR markup matches first client render.
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    setLastRefresh(new Date());
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const data = useMemo(() => {
    const students = getAll<Student>(KEYS.STUDENTS);
    const courses = getAll<Course>(KEYS.COURSES);
    const faculty = getAll<Faculty>(KEYS.FACULTY);
    const attendance = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const qrSessions = getAll<QRSession>(KEYS.QR_SESSIONS);
    const settings = getSettings();

    const today = getTodayString();
    const yesterday = dateOffset(1);
    const activeStudents = students.filter((s) => s.isActive);

    const totalActive = activeStudents.length;
    const todayPct = todayAttendanceRate(attendance, today, totalActive);
    const yesterdayPct = todayAttendanceRate(
      attendance,
      yesterday,
      totalActive
    );
    const activeQr = qrSessions.filter((s) => s.isActive).length;
    const defaulters = countDefaulters(
      students,
      attendance,
      settings.minAttendancePercent
    );
    const defaultersYesterday = countDefaulters(
      students,
      attendance.filter((r) => r.date <= yesterday),
      settings.minAttendancePercent
    );

    const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
      const date = dateOffset(6 - i);
      const dayRecs = attendance.filter((r) => r.date === date);
      const total = dayRecs.length || 1;
      const present =
        (dayRecs.filter((r) => r.status === "present").length / total) * 100;
      const late =
        (dayRecs.filter((r) => r.status === "late").length / total) * 100;
      return {
        day: dayLabel(date),
        date,
        present: Math.round(present),
        late: Math.round(late),
      };
    });

    const todayRecords = attendance.filter((r) => r.date === today);
    const courseWiseToday = courses.map((c) => {
      const courseRecs = todayRecords.filter((r) => r.courseId === c.id);
      const total = courseRecs.length || 1;
      return {
        name: c.courseCode,
        present: Math.round(
          (courseRecs.filter((r) => r.status === "present").length / total) *
            100
        ),
        late: Math.round(
          (courseRecs.filter((r) => r.status === "late").length / total) * 100
        ),
        absent: Math.round(
          (courseRecs.filter((r) => r.status === "absent").length / total) * 100
        ),
      };
    });

    const statusCounts = {
      present: todayRecords.filter((r) => r.status === "present").length,
      late: todayRecords.filter((r) => r.status === "late").length,
      absent: todayRecords.filter((r) => r.status === "absent").length,
      halfDay: todayRecords.filter((r) => r.status === "half-day").length,
    };
    const pieData = [
      { name: "Present", value: statusCounts.present, key: "present" },
      { name: "Late", value: statusCounts.late, key: "late" },
      { name: "Absent", value: statusCounts.absent, key: "absent" },
      { name: "Half-day", value: statusCounts.halfDay, key: "halfDay" },
    ].filter((d) => d.value > 0);

    const heatmapDays = Array.from({ length: 30 }, (_, i) => {
      const date = dateOffset(29 - i);
      const dayRecs = attendance.filter((r) => r.date === date);
      const total = dayRecs.length;
      const attended = dayRecs.filter(
        (r) =>
          r.status === "present" ||
          r.status === "late" ||
          r.status === "half-day"
      ).length;
      const percent =
        total === 0 ? 0 : Math.round((attended / total) * 100);
      return {
        date,
        percent,
        label: formatDate(date),
      };
    });

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const recentActivity = [...attendance]
      .sort(
        (a, b) =>
          new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
      )
      .slice(0, 20)
      .map((r) => {
        const student = studentMap.get(r.studentId);
        const course = courseMap.get(r.courseId);
        const subject =
          course?.schedule.find((s) => s.subjectId === r.subjectId)?.subject ??
          "—";
        return {
          ...r,
          studentName: student?.name ?? "Unknown",
          courseLabel: course
            ? `${course.courseCode}`
            : "—",
          subject,
        };
      });

    const activeSessions = qrSessions
      .filter((s) => s.isActive)
      .map((s) => {
        const c = courseMap.get(s.courseId);
        const total = c?.studentIds.length ?? 0;
        return {
          ...s,
          marked: s.markedStudentIds.length,
          total,
        };
      });

    const yesterdayActiveSessions = qrSessions.filter(
      (s) => s.date === yesterday
    ).length;

    return {
      stats: {
        totalActive,
        totalFaculty: faculty.length,
        totalCourses: courses.length,
        todayPct,
        activeQr,
        defaulters,
        trends: {
          students: 0,
          attendance: trendPercent(todayPct, yesterdayPct),
          qr: trendPercent(activeQr, yesterdayActiveSessions),
          defaulters: trendPercent(defaulters, defaultersYesterday),
        },
        minPercent: settings.minAttendancePercent,
        institutionName: settings.institutionName,
        academicYear: settings.academicYear,
        semesterName: settings.semesterName,
      },
      weeklyTrend,
      courseWiseToday,
      pieData,
      heatmapDays,
      recentActivity,
      activeSessions,
    };
  }, [refreshKey]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            {data.stats.institutionName}
          </h2>
          <p className="text-sm text-slate-500">
            {data.stats.semesterName} · AY {data.stats.academicYear}
            {lastRefresh && <> · Last updated {formatTime(lastRefresh)}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Students"
          value={data.stats.totalActive}
          subtitle="Enrolled across all courses"
          icon={Users}
          gradient="from-indigo-500 to-indigo-700"
          trend={data.stats.trends.students}
          delay={0}
        />
        <StatsCard
          title="Total Faculty"
          value={data.stats.totalFaculty}
          subtitle="Professors & Lecturers"
          icon={GraduationCap}
          gradient="from-emerald-500 to-green-700"
          delay={0.08}
        />
        <StatsCard
          title="Active Courses"
          value={data.stats.totalCourses}
          subtitle="This semester"
          icon={BookOpen}
          gradient="from-fuchsia-500 to-purple-600"
          delay={0.16}
        />
        <StatsCard
          title="Today's Attendance"
          value={data.stats.todayPct}
          subtitle="University-wide average"
          icon={UserCheck}
          gradient="from-cyan-500 to-blue-600"
          trend={data.stats.trends.attendance}
          suffix="%"
          delay={0.24}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard
          title="Active QR Sessions"
          value={data.stats.activeQr}
          subtitle="Live take-attendance windows"
          icon={QrCode}
          gradient="from-purple-500 to-violet-700"
          trend={data.stats.trends.qr}
          delay={0.32}
        />
        <StatsCard
          title="Defaulters"
          value={data.stats.defaulters}
          subtitle={`Below ${data.stats.minPercent}% university norm`}
          icon={AlertTriangle}
          gradient="from-rose-500 to-orange-600"
          trend={-data.stats.trends.defaulters}
          delay={0.4}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceChart
          title="Weekly Attendance Trend"
          subtitle="Present vs late — last 7 days"
        >
          <AreaChart data={data.weeklyTrend}>
            <defs>
              <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_THEME.present} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_THEME.present} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_THEME.late} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_THEME.late} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis dataKey="day" stroke={CHART_THEME.axis} tick={{ fill: CHART_THEME.tick, fontSize: 12 }} />
            <YAxis stroke={CHART_THEME.axis} tick={{ fill: CHART_THEME.tick, fontSize: 12 }} unit="%" />
            <RechartsTooltip content={<GlassTooltip />} />
            <Area
              type="monotone"
              dataKey="present"
              name="Present %"
              stroke={CHART_THEME.present}
              fill="url(#presentGrad)"
              strokeWidth={2}
              {...CHART_ANIMATION}
            />
            <Area
              type="monotone"
              dataKey="late"
              name="Late %"
              stroke={CHART_THEME.late}
              fill="url(#lateGrad)"
              strokeWidth={2}
              {...CHART_ANIMATION}
            />
          </AreaChart>
        </AttendanceChart>

        <AttendanceChart
          title="Course-wise Today"
          subtitle="Attendance breakdown by course"
        >
          <BarChart data={data.courseWiseToday}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis dataKey="name" stroke={CHART_THEME.axis} tick={{ fill: CHART_THEME.tick, fontSize: 11 }} />
            <YAxis stroke={CHART_THEME.axis} tick={{ fill: CHART_THEME.tick, fontSize: 12 }} unit="%" />
            <RechartsTooltip content={<GlassTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: CHART_THEME.tick }}
            />
            <Bar
              dataKey="present"
              name="Present"
              fill={CHART_THEME.presentGreen}
              radius={[4, 4, 0, 0]}
              {...CHART_ANIMATION}
            />
            <Bar
              dataKey="late"
              name="Late"
              fill={CHART_THEME.late}
              radius={[4, 4, 0, 0]}
              {...CHART_ANIMATION}
            />
            <Bar
              dataKey="absent"
              name="Absent"
              fill={CHART_THEME.absent}
              radius={[4, 4, 0, 0]}
              {...CHART_ANIMATION}
            />
          </BarChart>
        </AttendanceChart>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceChart
          title="Today's Distribution"
          subtitle="Status breakdown"
          height={300}
        >
          <PieChart>
            <Pie
              data={data.pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
              {...CHART_ANIMATION}
            >
              {data.pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip content={<GlassTooltip />} />
          </PieChart>
        </AttendanceChart>

        <CalendarHeatmap
          title="Monthly Attendance Heatmap"
          days={data.heatmapDays}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="mb-4 font-display text-lg font-semibold text-white">
              Recent Activity
            </h3>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {data.recentActivity.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                      {getInitials(item.studentName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {item.studentName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.courseLabel} · {item.subject}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatTime(item.markedAt)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.recentActivity.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  No attendance records yet
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-white">
            Active Sessions
          </h3>
          {data.activeSessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No active QR sessions
            </p>
          ) : (
            <div className="space-y-3">
              {data.activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"
                >
                  <p className="font-medium text-white">
                    {session.courseCode}
                  </p>
                  <p className="text-sm text-slate-400">{session.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Started {formatTime(session.startTime)}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-indigo-300">
                      {session.marked}/{session.total} marked
                    </span>
                    <Link
                      href="/admin/mark-attendance"
                      className="rounded-lg bg-indigo-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600"
                    >
                      View
                    </Link>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                      style={{
                        width: `${
                          session.total
                            ? (session.marked / session.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
