"use client";

import { ChevronDown, ChevronUp, Eye, Pencil, Trash2 } from "lucide-react";
import {
  getAttendanceBarColor,
  getInitials,
} from "@/lib/student-helpers";
import { cn } from "@/lib/utils";
import type { Student } from "@/types";
import type { StudentWithMeta } from "./StudentCard";

export type SortKey = "name" | "rollNo" | "className" | "attendancePercent";
export type SortDir = "asc" | "desc";

interface StudentTableProps {
  students: StudentWithMeta[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string, checked: boolean) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
  onView: (student: Student) => void;
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) return <ChevronDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3" />
  ) : (
    <ChevronDown className="h-3 w-3" />
  );
}

export function StudentTable({
  students,
  selectedIds,
  onSelectAll,
  onSelect,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onView,
}: StudentTableProps) {
  const allSelected =
    students.length > 0 && students.every((s) => selectedIds.has(s.id));

  const th = (key: SortKey, label: string) => (
    <th className="p-3 text-left">
      <button
        type="button"
        onClick={() => onSort(key)}
        className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-white"
      >
        {label}
        <SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="w-10 p-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-white/20"
              />
            </th>
            <th className="p-3 text-left text-xs font-medium uppercase text-slate-500">
              Photo
            </th>
            {th("name", "Name")}
            {th("rollNo", "Roll No")}
            {th("className", "Class")}
            {th("attendancePercent", "Attendance")}
            <th className="p-3 text-left text-xs font-medium uppercase text-slate-500">
              Status
            </th>
            <th className="p-3 text-right text-xs font-medium uppercase text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr
              key={s.id}
              className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
            >
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={(e) => onSelect(s.id, e.target.checked)}
                  className="rounded border-white/20"
                />
              </td>
              <td className="p-3">
                {s.photoURL ? (
                  <img
                    src={s.photoURL}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-[10px] font-bold text-white">
                    {getInitials(s.name)}
                  </div>
                )}
              </td>
              <td className="p-3 font-medium text-white">{s.name}</td>
              <td className="p-3 text-slate-400">{s.rollNo}</td>
              <td className="p-3 text-slate-400">{s.className}</td>
              <td className="p-3">
                <div className="flex min-w-[100px] items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        getAttendanceBarColor(s.attendancePercent)
                      )}
                      style={{ width: `${s.attendancePercent}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-slate-400">
                    {s.attendancePercent}%
                  </span>
                </div>
              </td>
              <td className="p-3">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    s.isActive
                      ? "bg-green-500/15 text-green-400"
                      : "bg-slate-500/15 text-slate-400"
                  )}
                >
                  {s.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onView(s)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-indigo-300"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
