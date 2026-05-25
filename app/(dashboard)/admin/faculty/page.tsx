"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { KEYS, getAll } from "@/lib/storage";
import type { AttendanceRecord, Course, Faculty } from "@/types";

export default function AdminFacultyPage() {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");

  const { faculty, courses, records } = useMemo(() => {
    return {
      faculty: getAll<Faculty>(KEYS.FACULTY),
      courses: getAll<Course>(KEYS.COURSES),
      records: getAll<AttendanceRecord>(KEYS.ATTENDANCE),
    };
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(faculty.map((f) => f.department))).sort(),
    [faculty]
  );

  const designations = useMemo(
    () => Array.from(new Set(faculty.map((f) => f.designation))).sort(),
    [faculty]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faculty.filter((f) => {
      if (filterDept && f.department !== filterDept) return false;
      if (filterDesignation && f.designation !== filterDesignation)
        return false;
      if (q) {
        const hay =
          `${f.name} ${f.email} ${f.employeeId} ${f.specialisation.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [faculty, search, filterDept, filterDesignation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Faculty Directory
          </h2>
          <p className="text-sm text-slate-500">
            {filtered.length} of {faculty.length} faculty members
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search faculty by name, employee id, email…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filterDesignation}
          onChange={(e) => setFilterDesignation(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="">All Designations</option>
          {designations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f) => {
          const facCourses = courses.filter((c) => c.facultyId === f.id);
          const totalStudents = facCourses.reduce(
            (sum, c) => sum + c.studentIds.length,
            0
          );
          const facRecords = records.filter((r) => r.facultyId === f.id);
          const present = facRecords.filter(
            (r) =>
              r.status === "present" ||
              r.status === "late" ||
              r.status === "half-day"
          ).length;
          const avgPct =
            facRecords.length === 0
              ? 0
              : Math.round((present / facRecords.length) * 100);

          return (
            <div
              key={f.id}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-lg font-semibold text-white">
                    {f.name}
                  </h3>
                  <p className="truncate text-xs text-slate-400">
                    {f.designation}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-indigo-300">
                    {f.employeeId}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-300">
                  {f.department}
                </span>
                {f.specialisation.slice(0, 2).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                <div>
                  <p className="text-base font-semibold text-white">
                    {facCourses.length}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Courses
                  </p>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    {totalStudents}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Students
                  </p>
                </div>
                <div>
                  <p className="text-base font-semibold text-emerald-300">
                    {avgPct}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Avg
                  </p>
                </div>
              </div>

              <div className="mt-3 truncate text-xs text-slate-500">
                {f.email}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <p className="text-sm text-slate-400">
            {faculty.length === 0
              ? "No faculty members yet."
              : "No faculty match your filters."}
          </p>
        </div>
      )}
    </div>
  );
}
