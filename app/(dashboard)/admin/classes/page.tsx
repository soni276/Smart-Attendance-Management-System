"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  CourseCard,
  type CourseCardData,
} from "@/components/courses/CourseCard";
import {
  CourseModal,
  type CourseFormData,
} from "@/components/courses/CourseModal";
import { DeleteCourseModal } from "@/components/courses/DeleteCourseModal";
import { KEYS, getAll, remove, save, saveMany } from "@/lib/storage";
import { generateId, getTodayString } from "@/lib/utils";
import type {
  AttendanceRecord,
  Course,
  Faculty,
  ScheduleSlot,
  Semester,
  Student,
} from "@/types";

function dayNameFromDate(d: Date): ScheduleSlot["day"] | null {
  const idx = d.getDay();
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

function getNextLecture(schedule: ScheduleSlot[]): string | null {
  const today = dayNameFromDate(new Date());
  if (!today) return null;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const todaySlots = schedule
    .filter((s) => s.day === today)
    .map((s) => {
      const [h, m] = s.startTime.split(":").map(Number);
      return { ...s, mins: h * 60 + m };
    })
    .sort((a, b) => a.mins - b.mins);

  const next = todaySlots.find((s) => s.mins >= nowMins);
  if (next) return `${next.subject} ${next.startTime}`;
  const tomorrow = schedule[0];
  return tomorrow ? `Next: ${tomorrow.subject}` : null;
}

export default function AdminCoursesPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSemester, setFilterSemester] = useState<Semester | "">("");
  const [filterBatch, setFilterBatch] = useState("");

  const { courses, faculty, students, records, today } = useMemo(() => {
    return {
      courses: getAll<Course>(KEYS.COURSES),
      faculty: getAll<Faculty>(KEYS.FACULTY),
      students: getAll<Student>(KEYS.STUDENTS),
      records: getAll<AttendanceRecord>(KEYS.ATTENDANCE),
      today: getTodayString(),
    };
  }, [refreshKey]);

  const departments = useMemo(
    () => Array.from(new Set(courses.map((c) => c.department))).sort(),
    [courses]
  );
  const batches = useMemo(
    () => Array.from(new Set(courses.map((c) => c.batch))).sort(),
    [courses]
  );

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (filterDept && c.department !== filterDept) return false;
      if (filterSemester && c.semester !== filterSemester) return false;
      if (filterBatch && c.batch !== filterBatch) return false;
      if (q) {
        const hay =
          `${c.courseCode} ${c.courseName} ${c.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, search, filterDept, filterSemester, filterBatch]);

  const cardData: CourseCardData[] = useMemo(() => {
    return filteredCourses.map((course) => {
      const fac =
        faculty.find((f) => f.id === course.facultyId) ?? null;
      const studentCount = course.studentIds.length;
      const todayRecs = records.filter(
        (r) => r.courseId === course.id && r.date === today
      );
      const present = todayRecs.filter(
        (r) =>
          r.status === "present" ||
          r.status === "late" ||
          r.status === "half-day"
      ).length;
      const todayPercent =
        studentCount === 0
          ? 0
          : Math.round(
              (present / Math.max(todayRecs.length, studentCount)) * 100
            );

      return {
        course,
        faculty: fac,
        studentCount,
        todayPercent: Math.min(100, todayPercent),
        nextLecture: getNextLecture(course.schedule),
      };
    });
  }, [filteredCourses, faculty, records, today]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleSave = (data: CourseFormData, id?: string) => {
    const course: Course = {
      id: id ?? generateId(),
      courseCode: data.courseCode.trim().toUpperCase(),
      courseName: data.courseName.trim(),
      department: data.department.trim(),
      semester: data.semester,
      batch: data.batch.trim(),
      facultyId: data.facultyId,
      studentIds: data.studentIds,
      credits: data.credits,
      schedule: data.schedule,
    };
    save(KEYS.COURSES, course);

    const studentSet = new Set(data.studentIds);
    const allStudents = getAll<Student>(KEYS.STUDENTS);
    allStudents.forEach((s) => {
      const inCourse = studentSet.has(s.id);
      const courseIdSet = new Set(s.courseIds);
      let changed = false;

      if (inCourse && !courseIdSet.has(course.id)) {
        courseIdSet.add(course.id);
        changed = true;
      } else if (!inCourse && courseIdSet.has(course.id)) {
        courseIdSet.delete(course.id);
        changed = true;
      }

      if (changed) {
        save(KEYS.STUDENTS, { ...s, courseIds: Array.from(courseIdSet) });
      }
    });

    const allFaculty = getAll<Faculty>(KEYS.FACULTY);
    allFaculty.forEach((f) => {
      const ids = f.courseIds.filter((cid) => cid !== course.id);
      if (f.id === course.facultyId) ids.push(course.id);
      if (
        ids.length !== f.courseIds.length ||
        f.id === course.facultyId
      ) {
        save(KEYS.FACULTY, { ...f, courseIds: [...new Set(ids)] });
      }
    });

    toast.success(id ? "Course updated" : "Course created");
    refresh();
  };

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) return;
    const course = deleteTarget;
    remove(KEYS.COURSES, course.id);

    const remainingStudents = getAll<Student>(KEYS.STUDENTS).map((s) =>
      s.courseIds.includes(course.id)
        ? { ...s, courseIds: s.courseIds.filter((c) => c !== course.id) }
        : s
    );
    saveMany(KEYS.STUDENTS, remainingStudents);

    const allFaculty = getAll<Faculty>(KEYS.FACULTY);
    allFaculty.forEach((f) => {
      if (f.courseIds.includes(course.id)) {
        save(KEYS.FACULTY, {
          ...f,
          courseIds: f.courseIds.filter((id) => id !== course.id),
        });
      }
    });
    setDeleteTarget(null);
    refresh();
    toast.success("Course deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Courses
          </h2>
          <p className="text-sm text-slate-500">
            {filteredCourses.length} of {courses.length} courses
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditCourse(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add Course
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by code or name…"
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
          value={filterSemester}
          onChange={(e) =>
            setFilterSemester(e.target.value as Semester | "")
          }
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="">All Semesters</option>
          {(
            ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"] as Semester[]
          ).map((s) => (
            <option key={s} value={s}>
              {s} Sem
            </option>
          ))}
        </select>
        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cardData.map((data) => (
          <CourseCard
            key={data.course.id}
            data={data}
            onViewStudents={(c) =>
              router.push(
                `/admin/students?course=${encodeURIComponent(c.id)}`
              )
            }
            onEdit={(c) => {
              setEditCourse(c);
              setModalOpen(true);
            }}
            onDelete={(c) => setDeleteTarget(c)}
          />
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <p className="text-sm text-slate-400">
            {courses.length === 0
              ? "No courses yet. Create your first course to get started."
              : "No courses match your filters."}
          </p>
        </div>
      )}

      <CourseModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditCourse(null);
        }}
        onSave={handleSave}
        faculty={faculty}
        students={students}
        editCourse={editCourse}
      />
      <DeleteCourseModal
        course={deleteTarget}
        studentCount={
          deleteTarget
            ? students.filter((s) => s.courseIds.includes(deleteTarget.id))
                .length
            : 0
        }
        recordCount={
          deleteTarget
            ? records.filter((r) => r.courseId === deleteTarget.id).length
            : 0
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
