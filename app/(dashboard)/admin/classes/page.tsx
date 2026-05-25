"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { ClassCard, type ClassCardData } from "@/components/classes/ClassCard";
import {
  ClassModal,
  type ClassFormData,
} from "@/components/classes/ClassModal";
import { DeleteClassModal } from "@/components/classes/DeleteClassModal";
import { KEYS, getAll, remove, save, saveMany } from "@/lib/storage";
import { generateId, getTodayString } from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  ScheduleSlot,
  Student,
  Teacher,
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

function getNextClass(schedule: ScheduleSlot[]): string | null {
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

export default function AdminClassesPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRoom | null>(null);

  const { classes, teachers, students, records, today } = useMemo(() => {
    return {
      classes: getAll<ClassRoom>(KEYS.CLASSES),
      teachers: getAll<Teacher>(KEYS.TEACHERS),
      students: getAll<Student>(KEYS.STUDENTS),
      records: getAll<AttendanceRecord>(KEYS.ATTENDANCE),
      today: getTodayString(),
    };
  }, [refreshKey]);

  const cardData: ClassCardData[] = useMemo(() => {
    return classes.map((classroom) => {
      const teacher = teachers.find((t) => t.id === classroom.teacherId) ?? null;
      const studentCount = classroom.studentIds.length;
      const todayRecs = records.filter(
        (r) => r.classId === classroom.id && r.date === today
      );
      const present = todayRecs.filter(
        (r) =>
          r.status === "present" || r.status === "late" || r.status === "half-day"
      ).length;
      const todayPercent =
        studentCount === 0
          ? 0
          : Math.round((present / Math.max(todayRecs.length, studentCount)) * 100);

      return {
        classroom,
        teacher,
        studentCount,
        todayPercent: Math.min(100, todayPercent),
        nextClass: getNextClass(classroom.schedule),
      };
    });
  }, [classes, teachers, records, today]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleSave = (data: ClassFormData, id?: string) => {
    const classroom: ClassRoom = {
      id: id ?? generateId(),
      name: data.name.trim(),
      section: data.section.trim(),
      department: data.department.trim(),
      teacherId: data.teacherId,
      schedule: data.schedule,
      studentIds: data.studentIds,
    };
    save(KEYS.CLASSES, classroom);

    const allStudents = getAll<Student>(KEYS.STUDENTS);
    const studentSet = new Set(data.studentIds);
    allStudents.forEach((s) => {
      const inClass = studentSet.has(s.id);
      if (inClass && s.classId !== classroom.id) {
        save(KEYS.STUDENTS, {
          ...s,
          classId: classroom.id,
          section: classroom.section,
          department: classroom.department,
        });
      } else if (!inClass && s.classId === classroom.id) {
        save(KEYS.STUDENTS, { ...s, classId: "" });
      }
    });

    const allClasses = getAll<ClassRoom>(KEYS.CLASSES);
    allClasses.forEach((cls) => {
      if (cls.id === classroom.id) return;
      const filteredIds = cls.studentIds.filter((sid) => !studentSet.has(sid));
      if (filteredIds.length !== cls.studentIds.length) {
        save(KEYS.CLASSES, { ...cls, studentIds: filteredIds });
      }
    });

    teachers.forEach((t) => {
      const ids = t.classIds.filter((cid) => cid !== classroom.id);
      if (t.id === classroom.teacherId) ids.push(classroom.id);
      if (
        ids.length !== t.classIds.length ||
        t.id === classroom.teacherId
      ) {
        save(KEYS.TEACHERS, { ...t, classIds: [...new Set(ids)] });
      }
    });

    toast.success(id ? "Class updated" : "Class created");
    refresh();
  };

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) return;
    const classroom = deleteTarget;
    remove(KEYS.CLASSES, classroom.id);
    const remainingStudents = getAll<Student>(KEYS.STUDENTS).map((s) =>
      s.classId === classroom.id ? { ...s, classId: "" } : s
    );
    saveMany(KEYS.STUDENTS, remainingStudents);
    const allTeachers = getAll<Teacher>(KEYS.TEACHERS);
    allTeachers.forEach((t) => {
      if (t.classIds.includes(classroom.id)) {
        save(KEYS.TEACHERS, {
          ...t,
          classIds: t.classIds.filter((id) => id !== classroom.id),
        });
      }
    });
    setDeleteTarget(null);
    refresh();
    toast.success("Class deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Classes
          </h2>
          <p className="text-sm text-slate-500">{classes.length} classes</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditClass(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add Class
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cardData.map((data) => (
          <ClassCard
            key={data.classroom.id}
            data={data}
            onViewStudents={(cls) =>
              router.push(`/admin/students?class=${encodeURIComponent(cls.id)}`)
            }
            onEdit={(cls) => {
              setEditClass(cls);
              setModalOpen(true);
            }}
            onDelete={(cls) => setDeleteTarget(cls)}
          />
        ))}
      </div>

      {classes.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <p className="text-sm text-slate-400">
            No classes yet. Create your first class to get started.
          </p>
        </div>
      )}

      <ClassModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditClass(null);
        }}
        onSave={handleSave}
        teachers={teachers}
        students={students}
        editClass={editClass}
      />
      <DeleteClassModal
        classroom={deleteTarget}
        studentCount={
          deleteTarget
            ? students.filter((s) => s.classId === deleteTarget.id).length
            : 0
        }
        recordCount={
          deleteTarget
            ? records.filter((r) => r.classId === deleteTarget.id).length
            : 0
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
