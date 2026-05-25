"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { KEYS, getAll } from "@/lib/storage";
import {
  calculateAttendancePercent,
  formatDate,
  getStatusColor,
  getTodayString,
} from "@/lib/utils";
import type { AttendanceRecord, Course, Student } from "@/types";

type ReportType = "student" | "course" | "subject" | "custom";

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("student");
  const [from, setFrom] = useState(dateOffset(30));
  const [to, setTo] = useState(getTodayString());
  const [courseFilter, setCourseFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const { students, courses, records, subjects } = useMemo(() => {
    const students = getAll<Student>(KEYS.STUDENTS);
    const courses = getAll<Course>(KEYS.COURSES);
    const all = getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter(
      (r) => r.date >= from && r.date <= to
    );
    const subjectMap = new Map<string, string>();
    courses.forEach((c) =>
      c.schedule.forEach((s) => subjectMap.set(s.subjectId, s.subject))
    );
    return { students, courses, records: all, subjects: subjectMap };
  }, [from, to]);

  const filteredRecords = useMemo(() => {
    let r = records;
    if (courseFilter) r = r.filter((x) => x.courseId === courseFilter);
    if (studentFilter) r = r.filter((x) => x.studentId === studentFilter);
    if (subjectFilter) r = r.filter((x) => x.subjectId === subjectFilter);
    return r;
  }, [records, courseFilter, studentFilter, subjectFilter]);

  const previewRows = useMemo(() => {
    if (reportType === "student") {
      const list = studentFilter
        ? students.filter((s) => s.id === studentFilter)
        : courseFilter
          ? students.filter((s) => s.courseIds?.includes(courseFilter))
          : students;

      return list.map((s) => {
        const pct = calculateAttendancePercent(filteredRecords, s.id);
        return {
          col1: s.name,
          col2: s.enrollmentNo,
          col3: `${s.department} · ${s.semester} Sem`,
          col4: `${pct}%`,
          col5: String(
            filteredRecords.filter((r) => r.studentId === s.id).length
          ),
        };
      });
    }

    if (reportType === "course") {
      const list = courseFilter
        ? courses.filter((c) => c.id === courseFilter)
        : courses;
      return list.map((c) => {
        const courseRecs = filteredRecords.filter((r) => r.courseId === c.id);
        const attended = courseRecs.filter(
          (r) =>
            r.status === "present" ||
            r.status === "late" ||
            r.status === "half-day"
        ).length;
        const pct =
          courseRecs.length === 0
            ? 0
            : Math.round((attended / courseRecs.length) * 100);
        return {
          col1: c.courseCode,
          col2: c.courseName,
          col3: String(c.studentIds.length),
          col4: `${pct}%`,
          col5: String(courseRecs.length),
        };
      });
    }

    if (reportType === "subject") {
      const ids = subjectFilter
        ? [subjectFilter]
        : [...new Set(filteredRecords.map((r) => r.subjectId))];
      return ids.map((sid) => {
        const recs = filteredRecords.filter((r) => r.subjectId === sid);
        const attended = recs.filter(
          (r) =>
            r.status === "present" ||
            r.status === "late" ||
            r.status === "half-day"
        ).length;
        const pct =
          recs.length === 0 ? 0 : Math.round((attended / recs.length) * 100);
        return {
          col1: subjects.get(sid) ?? sid,
          col2: String(recs.length),
          col3: `${pct}%`,
          col4: String(new Set(recs.map((r) => r.date)).size),
          col5: "—",
        };
      });
    }

    return filteredRecords.slice(0, 100).map((r) => {
      const s = students.find((st) => st.id === r.studentId);
      const course = courses.find((c) => c.id === r.courseId);
      return {
        col1: formatDate(r.date),
        col2: s?.name ?? r.studentId,
        col3: course ? `${course.courseCode}` : r.courseId,
        col4: subjects.get(r.subjectId) ?? r.subjectId,
        col5: r.status,
      };
    });
  }, [
    reportType,
    students,
    courses,
    filteredRecords,
    studentFilter,
    courseFilter,
    subjectFilter,
    subjects,
  ]);

  const headers = useMemo(() => {
    switch (reportType) {
      case "student":
        return [
          "Student",
          "Enrollment No",
          "Department / Sem",
          "Attendance %",
          "Sessions",
        ];
      case "course":
        return [
          "Course Code",
          "Course Name",
          "Students",
          "Attendance %",
          "Records",
        ];
      case "subject":
        return ["Subject / Paper", "Records", "Attendance %", "Days", "—"];
      default:
        return ["Date", "Student", "Course", "Subject", "Status"];
    }
  }, [reportType]);

  const downloadCsv = () => {
    const escape = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = headers.map(escape).join(",") + "\n";
    const rows = previewRows.map((r) =>
      [r.col1, r.col2, r.col3, r.col4, r.col5].map(escape).join(",")
    );
    const blob = new Blob(["\uFEFF" + header + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportType}-${getTodayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">
          Reports
        </h2>
        <p className="mt-1 text-slate-400">
          Generate and export attendance reports for courses, faculty and
          students.
        </p>
      </div>

      <div className="print:hidden flex flex-wrap gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Report type
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="student">Student Report</option>
            <option value="course">Course Report</option>
            <option value="subject">Subject / Paper Report</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Course</label>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.courseCode} · {c.courseName}
              </option>
            ))}
          </select>
        </div>
        {reportType === "student" && (
          <div>
            <label className="mb-1 block text-xs text-slate-500">Student</label>
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">All</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.enrollmentNo})
                </option>
              ))}
            </select>
          </div>
        )}
        {(reportType === "subject" || reportType === "custom") && (
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Subject / Paper
            </label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">All</option>
              {[...subjects.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          Preview
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500">
              {headers.map((h) => (
                <th key={h} className="py-2 pr-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 text-slate-300">
                <td className="py-2 pr-4">{row.col1}</td>
                <td className="py-2 pr-4">{row.col2}</td>
                <td className="py-2 pr-4">{row.col3}</td>
                <td
                  className={
                    reportType === "custom" && row.col5
                      ? `py-2 pr-4 capitalize ${getStatusColor(row.col5)}`
                      : "py-2 pr-4"
                  }
                >
                  {row.col4}
                </td>
                <td className="py-2">{row.col5}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {previewRows.length === 0 && (
          <p className="py-8 text-center text-slate-500">
            No data for selection.
          </p>
        )}
      </div>
    </div>
  );
}
