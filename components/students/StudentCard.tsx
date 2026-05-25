"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  getAttendanceBarColor,
  getInitials,
} from "@/lib/student-helpers";
import { cn } from "@/lib/utils";
import type { Student } from "@/types";

export interface StudentWithMeta extends Student {
  attendancePercent: number;
  primaryCourseLabel: string;
}

interface StudentCardProps {
  student: StudentWithMeta;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
  onView: (student: Student) => void;
}

function AttendanceRing({ percent }: { percent: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const color =
    percent < 75 ? "#ef4444" : percent <= 85 ? "#eab308" : "#22c55e";

  return (
    <svg width="72" height="72" className="-rotate-90">
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="6"
      />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      <text
        x="36"
        y="40"
        textAnchor="middle"
        className="rotate-90 fill-white text-xs font-bold"
        style={{ transformOrigin: "36px 36px" }}
      >
        {percent}%
      </text>
    </svg>
  );
}

export function StudentCard({
  student,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onView,
}: StudentCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-indigo-500/30 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(student.id, e.target.checked)}
            className="mt-1 rounded border-white/20"
          />
        )}
        <AttendanceRing percent={student.attendancePercent} />
      </div>

      <div className="mt-3 flex flex-col items-center text-center">
        {student.photoURL ? (
          <img
            src={student.photoURL}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
            {getInitials(student.name)}
          </div>
        )}
        <p className="mt-2 font-medium text-white">{student.name}</p>
        <p className="font-mono text-xs text-slate-500">
          {student.enrollmentNo}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-300">
            {student.department}
          </span>
          <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] text-fuchsia-300">
            Batch {student.batch}
          </span>
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-300">
            {student.semester} Sem
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full",
              getAttendanceBarColor(student.attendancePercent)
            )}
            style={{ width: `${student.attendancePercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => onView(student)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="View profile"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(student)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-indigo-300"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(student)}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
