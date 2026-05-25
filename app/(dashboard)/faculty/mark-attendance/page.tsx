"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  QrCode,
  Save,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { QRDisplay } from "@/components/attendance/QRDisplay";
import { SessionFeed } from "@/components/attendance/SessionFeed";
import { buildClientStoreSnapshot } from "@/lib/client-store";
import {
  KEYS,
  getAll,
  getCurrentUser,
  getSettings,
  save,
  saveMany,
} from "@/lib/storage";
import {
  cn,
  formatDate,
  formatTime,
  generateId,
  getTodayString,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  Course,
  Faculty,
  QRPayload,
  QRSession,
  ScheduleSlot,
  Student,
} from "@/types";

type TabMode = "qr" | "manual";
type AttendanceStatus = AttendanceRecord["status"];

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

function nowHHMM(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function addHourHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h + 1, m, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function upsertQRSession(session: QRSession): void {
  const all = getAll<QRSession>(KEYS.QR_SESSIONS);
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.push(session);
  saveMany(KEYS.QR_SESSIONS, all);
}

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  color: string;
}[] = [
  {
    value: "present",
    label: "P",
    color: "bg-green-500/20 text-green-400 border-green-500/40",
  },
  {
    value: "late",
    label: "L",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  },
  {
    value: "absent",
    label: "A",
    color: "bg-red-500/20 text-red-400 border-red-500/40",
  },
  {
    value: "half-day",
    label: "H",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  },
];

export default function FacultyMarkAttendancePage() {
  const [tab, setTab] = useState<TabMode>("qr");
  const [loading, setLoading] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  const user = getCurrentUser();
  const settings = getSettings();
  const allFaculty = getAll<Faculty>(KEYS.FACULTY);
  const faculty =
    allFaculty.find((f) => f.id === user?.userId) ??
    allFaculty.find((f) => f.email === user?.email);

  const facultyCourses = useMemo(() => {
    const courses = getAll<Course>(KEYS.COURSES);
    if (!faculty) return [];
    return courses.filter(
      (c) => faculty.courseIds.includes(c.id) || c.facultyId === faculty.id
    );
  }, [faculty]);

  const [activeSession, setActiveSession] = useState<QRSession | null>(null);
  const activeSessionRef = useRef<QRSession | null>(null);
  const sessionRestoredRef = useRef(false);
  const [qrString, setQrString] = useState("");
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null);

  activeSessionRef.current = activeSession;

  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [startTime, setStartTime] = useState(nowHHMM());
  const [endTime, setEndTime] = useState(addHourHHMM(nowHHMM()));
  const [lateAfter, setLateAfter] = useState(10);
  const [absentAfter, setAbsentAfter] = useState(25);

  const [manualCourseId, setManualCourseId] = useState("");
  const [manualSubjectId, setManualSubjectId] = useState("");
  const [manualDate, setManualDate] = useState(getTodayString());
  const [manualStudents, setManualStudents] = useState<Student[]>([]);
  const [manualMarks, setManualMarks] = useState<
    Record<string, AttendanceStatus>
  >({});

  const selectedCourse = facultyCourses.find((c) => c.id === courseId);
  const dayName = getCurrentDayName();

  const scheduleSlots = useMemo(() => {
    if (!selectedCourse || !dayName) return [];
    return selectedCourse.schedule.filter((s) => s.day === dayName);
  }, [selectedCourse, dayName]);

  useEffect(() => {
    if (!faculty || !user || sessionRestoredRef.current) return;

    const sessions = getAll<QRSession>(KEYS.QR_SESSIONS);
    const active = sessions.find(
      (s) => s.isActive && s.facultyId === user.userId
    );
    if (!active) return;

    sessionRestoredRef.current = true;
    setActiveSession(active);
    setCourseId(active.courseId);
    setSubjectId(active.subjectId);

    (async () => {
      try {
        const res = await fetch("/api/qr/rotate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: active.id,
            _store: buildClientStoreSnapshot(),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          upsertQRSession(data.session);
          setActiveSession(data.session);
          setQrString(data.qrString);
          setQrPayload(data.qrPayload);
        } else {
          setQrString(
            JSON.stringify({
              sessionId: active.id,
              nonce: active.currentNonce,
              signature: active.currentSignature,
            })
          );
        }
      } catch {
        setQrString(
          JSON.stringify({
            sessionId: active.id,
            nonce: active.currentNonce,
            signature: active.currentSignature,
          })
        );
      }
    })();
  }, [faculty, user]);

  useEffect(() => {
    if (scheduleSlots.length === 1) {
      setSubjectId(scheduleSlots[0].subjectId);
    }
  }, [scheduleSlots]);

  useEffect(() => {
    if (facultyCourses.length === 1 && !courseId) {
      setCourseId(facultyCourses[0].id);
    }
  }, [facultyCourses, courseId]);

  const handleStartSession = async () => {
    if (!user || !faculty || !selectedCourse || !subjectId) {
      toast.error("Please select course and subject");
      return;
    }

    const slot = selectedCourse.schedule.find((s) => s.subjectId === subjectId);
    if (!slot) {
      toast.error("Invalid subject for this course");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          subjectId,
          subject: slot.subject,
          facultyId: user.userId,
          facultyName: user.name,
          courseName: selectedCourse.courseName,
          courseCode: selectedCourse.courseCode,
          startTime,
          endTime,
          lateAfterMinutes: lateAfter,
          absentAfterMinutes: absentAfter,
          _store: buildClientStoreSnapshot(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start session");

      upsertQRSession(data.session);
      setActiveSession(data.session);
      setQrString(data.qrString);
      setQrPayload(data.qrPayload);
      toast.success("QR session started!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  const handleRotateQR = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session) return;

    try {
      const res = await fetch("/api/qr/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          _store: buildClientStoreSnapshot(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rotate failed");

      upsertQRSession(data.session);
      setActiveSession(data.session);
      setQrString(data.qrString);
      setQrPayload(data.qrPayload);
    } catch {
      toast.error("Failed to refresh QR code");
    }
  }, []);

  const handleSessionUpdate = useCallback((session: QRSession) => {
    setActiveSession((prev) => {
      if (!prev || prev.id !== session.id) return session;
      const sameMarked =
        prev.markedStudentIds.length === session.markedStudentIds.length &&
        prev.markedStudentIds.every(
          (id, i) => id === session.markedStudentIds[i]
        );
      if (
        sameMarked &&
        prev.currentNonce === session.currentNonce &&
        prev.currentSignature === session.currentSignature
      ) {
        return prev;
      }
      return session;
    });
  }, []);

  const handleEndSession = async () => {
    if (!activeSession || !user) return;

    setLoading(true);
    try {
      const res = await fetch("/api/qr/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          facultyId: user.userId,
          _store: buildClientStoreSnapshot(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to end session");

      const ended = { ...activeSession, isActive: false };
      upsertQRSession(ended);

      const course = facultyCourses.find(
        (c) => c.id === activeSession.courseId
      );
      if (course) {
        const markedAt = new Date().toISOString();
        const unmarked = course.studentIds.filter(
          (id) => !activeSession.markedStudentIds.includes(id)
        );
        const existing = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
        for (const studentId of unmarked) {
          const dup = existing.find(
            (r) =>
              r.studentId === studentId &&
              r.courseId === activeSession.courseId &&
              r.subjectId === activeSession.subjectId &&
              r.date === activeSession.date
          );
          if (!dup) {
            save(KEYS.ATTENDANCE, {
              id: generateId(),
              studentId,
              courseId: activeSession.courseId,
              subjectId: activeSession.subjectId,
              date: activeSession.date,
              status: "absent",
              markedBy: user.userId,
              facultyId: user.userId,
              markedAt,
              method: "manual",
            });
          }
        }
      }

      setActiveSession(null);
      sessionRestoredRef.current = false;
      setQrString("");
      setQrPayload(null);
      setShowEndModal(false);
      toast.success(`Session ended. ${data.absentMarked} marked absent.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadManualStudents = () => {
    const course = facultyCourses.find((c) => c.id === manualCourseId);
    if (!course) {
      toast.error("Select a course");
      return;
    }
    const students = getAll<Student>(KEYS.STUDENTS).filter(
      (s) => course.studentIds.includes(s.id) && s.isActive
    );
    setManualStudents(students);
    const marks: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      marks[s.id] = "present";
    });
    setManualMarks(marks);
    toast.success(`Loaded ${students.length} students`);
  };

  const manualCounts = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, halfDay: 0 };
    Object.values(manualMarks).forEach((s) => {
      if (s === "present") counts.present++;
      else if (s === "late") counts.late++;
      else if (s === "absent") counts.absent++;
      else if (s === "half-day") counts.halfDay++;
    });
    return counts;
  }, [manualMarks]);

  const handleManualSubmit = () => {
    if (
      !user ||
      !manualCourseId ||
      !manualSubjectId ||
      manualStudents.length === 0
    ) {
      toast.error("Load students and select course/subject first");
      return;
    }

    const existing = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    let saved = 0;

    for (const student of manualStudents) {
      const status = manualMarks[student.id] ?? "absent";
      const dup = existing.find(
        (r) =>
          r.studentId === student.id &&
          r.courseId === manualCourseId &&
          r.subjectId === manualSubjectId &&
          r.date === manualDate
      );

      if (dup) {
        save(KEYS.ATTENDANCE, {
          ...dup,
          status,
          markedAt: new Date().toISOString(),
          method: "manual",
        });
      } else {
        save(KEYS.ATTENDANCE, {
          id: generateId(),
          studentId: student.id,
          courseId: manualCourseId,
          subjectId: manualSubjectId,
          date: manualDate,
          status,
          markedBy: user.userId,
          facultyId: user.userId,
          markedAt: new Date().toISOString(),
          method: "manual",
        });
      }
      saved++;
    }

    toast.success(`Saved attendance for ${saved} students`);
  };

  const activeCourse = facultyCourses.find(
    (c) => c.id === activeSession?.courseId
  );

  if (!user || !faculty) {
    return (
      <p className="text-slate-400">
        Please log in as faculty to take attendance.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Take Attendance
          </h2>
          <p className="text-sm text-slate-500">
            QR session or manual entry · {settings.semesterName}
          </p>
        </div>

        <div className="relative flex rounded-xl bg-white/5 p-1">
          <motion.div
            layoutId="attendance-tab"
            className="absolute inset-y-1 rounded-lg bg-indigo-600"
            style={{
              width: "calc(50% - 4px)",
              left: tab === "qr" ? "4px" : "calc(50%)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          <button
            type="button"
            onClick={() => setTab("qr")}
            className={cn(
              "relative z-10 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === "qr" ? "text-white" : "text-slate-400"
            )}
          >
            <QrCode className="h-4 w-4" />
            QR Session
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={cn(
              "relative z-10 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === "manual" ? "text-white" : "text-slate-400"
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Manual
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "qr" ? (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {!activeSession ? (
              <div className="mx-auto max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <h3 className="mb-4 font-display text-lg font-semibold text-white">
                  Start QR Session
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Course
                    </label>
                    <select
                      value={courseId}
                      onChange={(e) => {
                        setCourseId(e.target.value);
                        setSubjectId("");
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-indigo-500/50"
                    >
                      <option value="">Select course</option>
                      {facultyCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.courseCode} · {c.courseName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Subject / Paper {dayName ? `(${dayName})` : ""}
                    </label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      disabled={!courseId}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-indigo-500/50 disabled:opacity-50"
                    >
                      <option value="">Select subject / paper</option>
                      {scheduleSlots.map((s) => (
                        <option key={s.subjectId} value={s.subjectId}>
                          {s.subject} ({s.startTime}–{s.endTime})
                          {s.room ? ` · ${s.room}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        Start
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        End
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        Late after (min)
                      </label>
                      <input
                        type="number"
                        value={lateAfter}
                        onChange={(e) => setLateAfter(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
                        Absent after (min)
                      </label>
                      <input
                        type="number"
                        value={absentAfter}
                        onChange={(e) => setAbsentAfter(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartSession}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <QrCode className="h-5 w-5" />
                    )}
                    Start QR Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <QRDisplay
                    qrString={qrString}
                    expirySeconds={settings.qrExpirySeconds}
                    sessionId={activeSession.id}
                    signature={
                      qrPayload?.signature ?? activeSession.currentSignature
                    }
                    courseLabel={`${activeSession.courseCode} · ${activeSession.courseName}`}
                    subjectLabel={activeSession.subject}
                    dateLabel={formatDate(activeSession.date)}
                    timeLabel={`${formatTime(activeSession.startTime)} – ${formatTime(activeSession.endTime)}`}
                    onExpire={handleRotateQR}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEndModal(true)}
                    className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20"
                  >
                    End Session
                  </button>
                </div>

                <div className="lg:col-span-2">
                  {activeCourse && (
                    <SessionFeed
                      session={activeSession}
                      course={activeCourse}
                      onSessionUpdate={handleSessionUpdate}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowEndModal(true)}
                    className="mt-4 w-full rounded-xl border border-orange-500/30 bg-orange-500/10 py-2.5 text-sm font-medium text-orange-300 hover:bg-orange-500/20"
                  >
                    Mark Remaining Absent
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <select
                value={manualCourseId}
                onChange={(e) => setManualCourseId(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              >
                <option value="">Course</option>
                {facultyCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} · {c.courseName}
                  </option>
                ))}
              </select>
              <select
                value={manualSubjectId}
                onChange={(e) => setManualSubjectId(e.target.value)}
                disabled={!manualCourseId}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="">Subject / Paper</option>
                {(
                  facultyCourses.find((c) => c.id === manualCourseId)
                    ?.schedule ?? []
                ).map((s, i) => (
                  <option key={`${s.subjectId}-${i}`} value={s.subjectId}>
                    {s.subject}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={handleLoadManualStudents}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Users className="h-4 w-4" />
                Load Students
              </button>
            </div>

            {manualStudents.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const m: Record<string, AttendanceStatus> = {};
                      manualStudents.forEach((s) => {
                        m[s.id] = "present";
                      });
                      setManualMarks(m);
                    }}
                    className="rounded-lg border border-green-500/30 px-3 py-1.5 text-xs text-green-400"
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const m: Record<string, AttendanceStatus> = {};
                      manualStudents.forEach((s) => {
                        m[s.id] = "absent";
                      });
                      setManualMarks(m);
                    }}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400"
                  >
                    Mark All Absent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const m: Record<string, AttendanceStatus> = {};
                      manualStudents.forEach((s) => {
                        m[s.id] = "present";
                      });
                      setManualMarks(m);
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400"
                  >
                    Reset All
                  </button>
                  <span className="ml-auto rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-400">
                    Present {manualCounts.present}
                  </span>
                  <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                    Late {manualCounts.late}
                  </span>
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-400">
                    Absent {manualCounts.absent}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-slate-500">
                        <th className="p-4">Student</th>
                        <th className="p-4">Enrollment No</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualStudents.map((s) => (
                        <tr key={s.id} className="border-b border-white/[0.04]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/80 text-xs font-bold text-white">
                                {s.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-white">{s.name}</span>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-slate-400">
                            {s.enrollmentNo}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    setManualMarks((prev) => ({
                                      ...prev,
                                      [s.id]: opt.value,
                                    }))
                                  }
                                  className={cn(
                                    "rounded-lg border px-3 py-1 text-xs font-bold transition",
                                    manualMarks[s.id] === opt.value
                                      ? opt.color
                                      : "border-white/10 text-slate-500 hover:bg-white/5"
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleManualSubmit}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 py-3 font-semibold text-white"
                >
                  <Save className="h-5 w-5" />
                  Submit Attendance
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6"
          >
            <div className="mb-4 flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-display text-lg font-semibold text-white">
                End QR Session?
              </h3>
            </div>
            <p className="text-sm text-slate-400">
              This will close the session and mark all unmarked students as
              absent.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndSession}
                disabled={loading}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                {loading ? "Ending…" : "End Session"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
