"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Save,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import {
  KEYS,
  getAll,
  getCurrentUser,
  save,
  saveMany,
} from "@/lib/storage";
import {
  cn,
  generateId,
  getStatusColor,
  getTodayString,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  ScheduleSlot,
  Student,
  Teacher,
} from "@/types";

type AttendanceStatus = AttendanceRecord["status"];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] =
  [
    {
      value: "present",
      label: "P",
      color:
        "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30",
    },
    {
      value: "late",
      label: "L",
      color:
        "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30",
    },
    {
      value: "absent",
      label: "A",
      color:
        "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30",
    },
    {
      value: "half-day",
      label: "H",
      color:
        "bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30",
    },
  ];

export default function AdminMarkAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [search, setSearch] = useState("");
  const [overriding, setOverriding] = useState(false);

  const data = useMemo(() => {
    void refreshKey;
    if (typeof window === "undefined") return null;
    const user = getCurrentUser();
    if (!user || user.role !== "admin") return null;
    return {
      user,
      classes: getAll<ClassRoom>(KEYS.CLASSES),
      teachers: getAll<Teacher>(KEYS.TEACHERS),
      students: getAll<Student>(KEYS.STUDENTS),
      records: getAll<AttendanceRecord>(KEYS.ATTENDANCE),
    };
  }, [refreshKey]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const selectedClass = useMemo(
    () => data?.classes.find((c) => c.id === classId) ?? null,
    [data, classId]
  );

  const subjectOptions: ScheduleSlot[] = useMemo(() => {
    if (!selectedClass) return [];
    const seen = new Set<string>();
    return selectedClass.schedule.filter((s) => {
      if (seen.has(s.subjectId)) return false;
      seen.add(s.subjectId);
      return true;
    });
  }, [selectedClass]);

  const classStudents: Student[] = useMemo(() => {
    if (!data || !selectedClass) return [];
    const inClass = new Set(selectedClass.studentIds);
    return data.students
      .filter((s) => inClass.has(s.id) && s.isActive)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [data, selectedClass]);

  // Load existing records when key fields change
  useEffect(() => {
    if (!data || !classId || !subjectId || !date) {
      setMarks({});
      return;
    }
    const existing = data.records.filter(
      (r) =>
        r.classId === classId && r.subjectId === subjectId && r.date === date
    );
    const mp: Record<string, AttendanceStatus> = {};
    classStudents.forEach((s) => {
      mp[s.id] = "present";
    });
    existing.forEach((r) => {
      mp[r.studentId] = r.status;
    });
    setMarks(mp);
    setOverriding(existing.length > 0);
  }, [data, classId, subjectId, date, classStudents]);

  // Auto-pick teacher when class changes
  useEffect(() => {
    if (!data || !selectedClass) return;
    if (!teacherId || !data.teachers.find((t) => t.id === teacherId)) {
      const t =
        data.teachers.find((t) => t.id === selectedClass.teacherId) ??
        data.teachers[0];
      if (t) setTeacherId(t.id);
    }
  }, [data, selectedClass, teacherId]);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q)
    );
  }, [classStudents, search]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, halfDay: 0 };
    Object.values(marks).forEach((s) => {
      if (s === "present") c.present++;
      else if (s === "late") c.late++;
      else if (s === "absent") c.absent++;
      else if (s === "half-day") c.halfDay++;
    });
    return c;
  }, [marks]);

  if (loading) return <TableSkeleton rows={8} />;

  if (!data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admin only"
        description="Sign in with an admin account to mark or override attendance."
      />
    );
  }

  if (data.classes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No classes"
        description="Create a class first before marking attendance."
      />
    );
  }

  const setAll = (status: AttendanceStatus) => {
    const m: Record<string, AttendanceStatus> = {};
    classStudents.forEach((s) => {
      m[s.id] = status;
    });
    setMarks(m);
    toast.success(
      `Marked all ${classStudents.length} students as ${status}`
    );
  };

  const handleSubmit = () => {
    if (!classId || !subjectId || !teacherId || !date) {
      toast.error("Select class, subject, teacher and date");
      return;
    }
    if (classStudents.length === 0) {
      toast.error("This class has no active students");
      return;
    }

    const all = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const otherRecords = all.filter(
      (r) =>
        !(r.classId === classId && r.subjectId === subjectId && r.date === date)
    );

    const now = new Date().toISOString();
    const updated: AttendanceRecord[] = classStudents.map((s) => {
      const existing = all.find(
        (r) =>
          r.studentId === s.id &&
          r.classId === classId &&
          r.subjectId === subjectId &&
          r.date === date
      );
      const status = marks[s.id] ?? "absent";
      return {
        id: existing?.id ?? generateId(),
        studentId: s.id,
        classId,
        subjectId,
        date,
        status,
        markedBy: teacherId,
        markedAt: now,
        method: "manual",
      };
    });

    saveMany(KEYS.ATTENDANCE, [...otherRecords, ...updated]);
    toast.success(
      overriding
        ? `Overrode attendance for ${updated.length} students`
        : `Saved attendance for ${updated.length} students`
    );
    setOverriding(true);
    setRefreshKey((k) => k + 1);
  };

  const overrideOne = (studentId: string, status: AttendanceStatus) => {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          Mark Attendance (Admin)
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Manually mark or override attendance for any class, subject and date.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Class</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSubjectId("");
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">Select class</option>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · Section {c.section}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!classId}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="">Select subject</option>
              {subjectOptions.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subject}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Teacher</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">Select teacher</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        {overriding && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            Existing records detected for this class/subject/date. Saving will
            overwrite them.
          </div>
        )}
      </div>

      {classId && subjectId && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-xs text-slate-500">Present</p>
              <p className="font-display text-2xl font-bold text-green-400">
                {counts.present}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-xs text-slate-500">Late</p>
              <p className="font-display text-2xl font-bold text-yellow-400">
                {counts.late}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-xs text-slate-500">Absent</p>
              <p className="font-display text-2xl font-bold text-red-400">
                {counts.absent}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-xs text-slate-500">Half-day</p>
              <p className="font-display text-2xl font-bold text-orange-400">
                {counts.halfDay}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students by name or roll…"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setAll("present")}
              className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/20"
            >
              All Present
            </button>
            <button
              type="button"
              onClick={() => setAll("absent")}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
            >
              All Absent
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="ml-auto flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {overriding ? "Override & Save" : "Save Attendance"}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            {visibleStudents.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No students match this filter.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="p-4">Roll</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Current</th>
                    <th className="p-4">Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((s, i) => {
                    const current = marks[s.id];
                    return (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="border-b border-white/[0.04]"
                      >
                        <td className="p-4 text-slate-400">{s.rollNo}</td>
                        <td className="p-4 text-white">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span>{s.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs capitalize",
                              getStatusColor(current ?? "present")
                            )}
                          >
                            {current ?? "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => overrideOne(s.id, opt.value)}
                                className={cn(
                                  "h-9 w-9 rounded-lg border text-xs font-bold transition",
                                  current === opt.value
                                    ? opt.color
                                    : "border-white/10 text-slate-500 hover:bg-white/5"
                                )}
                                aria-label={opt.value}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {(!classId || !subjectId) && (
        <EmptyState
          icon={ClipboardCheck}
          title="Pick class & subject"
          description="Select a class and subject to begin marking attendance."
        />
      )}
    </motion.div>
  );
}
