"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { KEYS, getAll } from "@/lib/storage";
import { formatTime, getStatusColor } from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  QRSession,
  Student,
} from "@/types";

interface SessionFeedProps {
  session: QRSession;
  classRoom: ClassRoom;
  pollIntervalMs?: number;
  onSessionUpdate?: (session: QRSession) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function SessionFeed({
  session,
  classRoom,
  pollIntervalMs = 5000,
  onSessionUpdate,
}: SessionFeedProps) {
  const [tick, setTick] = useState(0);
  const [pendingOpen, setPendingOpen] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  const { liveSession, markedEntries, pendingStudents, total } = useMemo(() => {
    const sessions = getAll<QRSession>(KEYS.QR_SESSIONS);
    const live = sessions.find((s) => s.id === session.id) ?? session;

    const students = getAll<Student>(KEYS.STUDENTS);
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const attendance = getAll<AttendanceRecord>(KEYS.ATTENDANCE);

    const sessionRecords = attendance
      .filter(
        (r) =>
          r.classId === live.classId &&
          r.subjectId === live.subjectId &&
          r.date === live.date &&
          live.markedStudentIds.includes(r.studentId)
      )
      .sort(
        (a, b) =>
          new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
      );

    const markedEntries = sessionRecords.map((r) => {
      const student = studentMap.get(r.studentId);
      return {
        record: r,
        student,
      };
    });

    const pendingStudents = classRoom.studentIds
      .filter((id) => !live.markedStudentIds.includes(id))
      .map((id) => studentMap.get(id))
      .filter((s): s is Student => !!s);

    return {
      liveSession: live,
      markedEntries,
      pendingStudents,
      total: classRoom.studentIds.length,
    };
  }, [session, classRoom, tick]);

  const sessionSyncKey = `${liveSession.id}:${liveSession.markedStudentIds.join(",")}:${liveSession.currentNonce}`;

  useEffect(() => {
    onSessionUpdate?.(liveSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when attendance data changes
  }, [sessionSyncKey]);

  const markedCount = liveSession.markedStudentIds.length;
  const progress = total > 0 ? (markedCount / total) * 100 : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">
            Live Attendance
          </h3>
          <span className="flex items-center gap-1 text-sm text-indigo-300">
            <Users className="h-4 w-4" />
            {markedCount} / {total}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">Students marked</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {markedEntries.map(({ record, student }) => (
            <motion.div
              key={record.id}
              layout
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                {student ? getInitials(student.name) : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {student?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-slate-500">{student?.rollNo}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(record.status)}`}
              >
                {record.status}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {formatTime(record.markedAt)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {markedEntries.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            Waiting for students to scan…
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={() => setPendingOpen(!pendingOpen)}
          className="flex w-full items-center justify-between text-sm font-medium text-slate-300"
        >
          Pending Students ({pendingStudents.length})
          {pendingOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {pendingOpen && (
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {pendingStudents.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5"
              >
                <span>{s.name}</span>
                <span>{s.rollNo}</span>
              </li>
            ))}
            {pendingStudents.length === 0 && (
              <li className="py-2 text-center text-xs text-green-400">
                All students marked!
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
