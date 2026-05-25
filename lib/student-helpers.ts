import type { AttendanceRecord, Course, Student } from "@/types";
import { calculateAttendancePercent } from "@/lib/utils";

export function getStudentAttendancePercent(
  studentId: string,
  records: AttendanceRecord[]
): number {
  return calculateAttendancePercent(records, studentId);
}

export function getAttendanceBarColor(percent: number): string {
  if (percent < 75) return "bg-red-500";
  if (percent <= 85) return "bg-yellow-500";
  return "bg-green-500";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function courseDisplayName(
  courseId: string,
  courses: Course[]
): string {
  const c = courses.find((x) => x.id === courseId);
  if (!c) return "—";
  return `${c.courseCode} · ${c.courseName}`;
}

export function getStudentCourses(
  student: Student,
  courses: Course[]
): Course[] {
  return courses.filter((c) => student.courseIds.includes(c.id));
}

export function slugSubjectId(name: string): string {
  return `sub-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-4)}`;
}
