"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Award, Clock, Eye, Pencil, Trash2, Users } from "lucide-react";
import { getInitials } from "@/lib/student-helpers";
import type { Course, Faculty } from "@/types";

export interface CourseCardData {
  course: Course;
  faculty: Faculty | null;
  studentCount: number;
  todayPercent: number;
  nextLecture: string | null;
}

interface CourseCardProps {
  data: CourseCardData;
  onViewStudents: (course: Course) => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
}

function MiniDonut({ percent }: { percent: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width="48" height="48" className="-rotate-90">
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="5"
      />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth="5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CourseCard({
  data,
  onViewStudents,
  onEdit,
  onDelete,
}: CourseCardProps) {
  const { course, faculty, studentCount, todayPercent, nextLecture } = data;
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateX = Math.max(-5, Math.min(5, -y * 10)).toFixed(2);
    const rotateY = Math.max(-5, Math.min(5, x * 10)).toFixed(2);
    setTransform(
      `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`
    );
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTransform("")}
      style={{ transform }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-shadow hover:shadow-xl hover:shadow-indigo-500/10"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl font-bold text-white truncate">
            {course.courseName}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-mono text-indigo-300">
              {course.courseCode}
            </span>
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              {course.department}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-300">
              {course.semester} Sem
            </span>
            <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-300">
              Batch {course.batch}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
              <Award className="h-3 w-3" />
              {course.credits} cr
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white">
          {faculty ? getInitials(faculty.name) : "?"}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white truncate">
            {faculty?.name ?? "Unassigned"}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Users className="h-3 w-3" />
            {studentCount} students
            {faculty?.designation ? (
              <span className="ml-1 truncate">· {faculty.designation}</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-2">
          <MiniDonut percent={todayPercent} />
          <div>
            <p className="text-xs text-slate-500">Today</p>
            <p className="text-sm font-medium text-white">{todayPercent}%</p>
          </div>
        </div>
        {nextLecture && (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            {nextLecture}
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onViewStudents(course)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 py-2 text-xs text-slate-300 hover:bg-white/10"
        >
          <Eye className="h-3.5 w-3.5" /> Students
        </button>
        <button
          type="button"
          onClick={() => onEdit(course)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(course)}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
