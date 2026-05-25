"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import toast from "react-hot-toast";
import {
  AddStudentModal,
  type StudentFormData,
} from "@/components/students/AddStudentModal";
import { CsvImportModal } from "@/components/students/CsvImportModal";
import { DeleteStudentModal } from "@/components/students/DeleteStudentModal";
import {
  StudentCard,
  type StudentWithMeta,
} from "@/components/students/StudentCard";
import { StudentDetailDrawer } from "@/components/students/StudentDetailDrawer";
import {
  StudentTable,
  type SortDir,
  type SortKey,
} from "@/components/students/StudentTable";
import { getStudentAttendancePercent } from "@/lib/student-helpers";
import {
  KEYS,
  getAll,
  getSettings,
  remove,
  save,
  saveMany,
} from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type { AttendanceRecord, ClassRoom, Student } from "@/types";

const PAGE_SIZE = 10;

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function AdminStudentsPage() {
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  useEffect(() => {
    const param = searchParams.get("class");
    if (param) setClassFilter(param);
  }, [searchParams]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const minPercent = getSettings().minAttendancePercent;

  const { students, classes, records } = useMemo(() => {
    return {
      students: getAll<Student>(KEYS.STUDENTS),
      classes: getAll<ClassRoom>(KEYS.CLASSES),
      records: getAll<AttendanceRecord>(KEYS.ATTENDANCE),
    };
  }, [refreshKey]);

  const enriched: StudentWithMeta[] = useMemo(() => {
    return students.map((s) => ({
      ...s,
      attendancePercent: getStudentAttendancePercent(s.id, records),
      className:
        classes.find((c) => c.id === s.classId)?.name ?? "—",
    }));
  }, [students, classes, records]);

  const filtered = useMemo(() => {
    let list = [...enriched];
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      );
    }
    if (classFilter !== "all") {
      list = list.filter(
        (s) =>
          s.classId === classFilter ||
          s.className.toLowerCase() === classFilter.toLowerCase()
      );
    }
    if (statusFilter === "active") list = list.filter((s) => s.isActive);
    if (statusFilter === "inactive") list = list.filter((s) => !s.isActive);
    if (attendanceFilter === "above75")
      list = list.filter((s) => s.attendancePercent >= 75);
    if (attendanceFilter === "below75")
      list = list.filter((s) => s.attendancePercent < 75);
    if (attendanceFilter === "critical")
      list = list.filter((s) => s.attendancePercent < minPercent);

    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
    return list;
  }, [
    enriched,
    debouncedSearch,
    classFilter,
    statusFilter,
    attendanceFilter,
    sortKey,
    sortDir,
    minPercent,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [debouncedSearch, classFilter, statusFilter, attendanceFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleSaveStudent = (data: StudentFormData, id?: string) => {
    const student: Student = {
      id: id ?? generateId(),
      name: data.name.trim(),
      rollNo: data.rollNo.trim(),
      email: data.email.trim(),
      phone: data.phone || undefined,
      classId: data.classId,
      section: data.section,
      department: data.department,
      photoURL: data.photoURL,
      faceDescriptor: data.faceDescriptor,
      enrolledAt: id
        ? students.find((s) => s.id === id)?.enrolledAt ?? new Date().toISOString()
        : new Date().toISOString(),
      isActive: data.isActive,
    };
    save(KEYS.STUDENTS, student);

    const allClasses = getAll<ClassRoom>(KEYS.CLASSES);
    allClasses.forEach((cls) => {
      const ids = cls.studentIds.filter((sid) => sid !== student.id);
      if (cls.id === student.classId) ids.push(student.id);
      if (ids.length !== cls.studentIds.length || cls.id === student.classId) {
        save(KEYS.CLASSES, { ...cls, studentIds: [...new Set(ids)] });
      }
    });

    toast.success(id ? "Student updated" : "Student added");
    refresh();
  };

  const handleDelete = useCallback(() => {
    if (!deleteStudent) return;
    remove(KEYS.STUDENTS, deleteStudent.id);
    const att = getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter(
      (r) => r.studentId !== deleteStudent.id
    );
    saveMany(KEYS.ATTENDANCE, att);
    const allClasses = getAll<ClassRoom>(KEYS.CLASSES);
    allClasses.forEach((cls) => {
      if (cls.studentIds.includes(deleteStudent.id)) {
        save(KEYS.CLASSES, {
          ...cls,
          studentIds: cls.studentIds.filter((id) => id !== deleteStudent.id),
        });
      }
    });
    toast.success("Student deleted");
    setDeleteStudent(null);
    refresh();
  }, [deleteStudent]);

  const handleCsvImport = (newStudents: Student[]) => {
    const existing = getAll<Student>(KEYS.STUDENTS);
    saveMany(KEYS.STUDENTS, [...existing, ...newStudents]);
    const allClasses = getAll<ClassRoom>(KEYS.CLASSES);
    newStudents.forEach((s) => {
      const cls = allClasses.find((c) => c.id === s.classId);
      if (cls && !cls.studentIds.includes(s.id)) {
        save(KEYS.CLASSES, { ...cls, studentIds: [...cls.studentIds, s.id] });
      }
    });
    refresh();
    return { imported: newStudents.length, failed: [] as { row: number; reason: string }[] };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Students
          </h2>
          <p className="text-sm text-slate-500">{filtered.length} students</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCsvOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditStudent(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search name, roll, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
        />
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.section}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={attendanceFilter}
          onChange={(e) => setAttendanceFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
        >
          <option value="all">All attendance</option>
          <option value="above75">Above 75%</option>
          <option value="below75">Below 75%</option>
          <option value="critical">Critical (&lt;{minPercent}%)</option>
        </select>
        <div className="flex rounded-lg bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setView("table")}
            className={`rounded-md p-2 ${view === "table" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`rounded-md p-2 ${view === "grid" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Add a student or adjust your search and filters."
          actionLabel="Add Student"
          onAction={() => {
            setEditStudent(null);
            setModalOpen(true);
          }}
        />
      ) : view === "table" ? (
        <StudentTable
          students={paginated}
          selectedIds={selectedIds}
          onSelectAll={(checked) => {
            if (checked) setSelectedIds(new Set(paginated.map((s) => s.id)));
            else setSelectedIds(new Set());
          }}
          onSelect={(id, checked) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            });
          }}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onEdit={(s) => {
            setEditStudent(s);
            setModalOpen(true);
          }}
          onDelete={setDeleteStudent}
          onView={setDetailStudent}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              onEdit={(st) => {
                setEditStudent(st);
                setModalOpen(true);
              }}
              onDelete={setDeleteStudent}
              onView={setDetailStudent}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-white/10 p-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-white/10 p-2 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AddStudentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditStudent(null);
        }}
        onSave={handleSaveStudent}
        classes={classes}
        editStudent={editStudent}
      />
      <CsvImportModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        classes={classes}
        onImport={handleCsvImport}
      />
      <DeleteStudentModal
        student={deleteStudent}
        onClose={() => setDeleteStudent(null)}
        onConfirm={handleDelete}
      />
      <StudentDetailDrawer
        student={detailStudent}
        classRoom={
          detailStudent
            ? classes.find((c) => c.id === detailStudent.classId) ?? null
            : null
        }
        records={records}
        onClose={() => setDetailStudent(null)}
      />
    </div>
  );
}
