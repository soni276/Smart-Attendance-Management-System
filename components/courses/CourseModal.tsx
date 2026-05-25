"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { slugSubjectId } from "@/lib/student-helpers";
import type {
  Course,
  Faculty,
  ScheduleSlot,
  Semester,
  Student,
} from "@/types";

const DAYS: ScheduleSlot["day"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SEMESTERS: Semester[] = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
];

export interface CourseFormData {
  courseName: string;
  courseCode: string;
  department: string;
  semester: Semester;
  batch: string;
  credits: number;
  facultyId: string;
  schedule: ScheduleSlot[];
  studentIds: string[];
}

interface CourseModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CourseFormData, id?: string) => void;
  faculty: Faculty[];
  students: Student[];
  editCourse?: Course | null;
}

const empty: CourseFormData = {
  courseName: "",
  courseCode: "",
  department: "",
  semester: "1st",
  batch: "",
  credits: 4,
  facultyId: "",
  schedule: [],
  studentIds: [],
};

export function CourseModal({
  open,
  onClose,
  onSave,
  faculty,
  students,
  editCourse,
}: CourseModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CourseFormData>(empty);
  const [selectedDay, setSelectedDay] = useState<ScheduleSlot["day"]>("Monday");
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setStudentSearch("");
    if (editCourse) {
      setForm({
        courseName: editCourse.courseName,
        courseCode: editCourse.courseCode,
        department: editCourse.department,
        semester: editCourse.semester,
        batch: editCourse.batch,
        credits: editCourse.credits,
        facultyId: editCourse.facultyId,
        schedule: [...editCourse.schedule],
        studentIds: [...editCourse.studentIds],
      });
    } else {
      setForm(empty);
    }
  }, [open, editCourse]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = students.filter(
      (s) =>
        s.isActive &&
        (form.department ? s.department === form.department : true) &&
        (form.batch ? s.batch === form.batch : true)
    );
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.enrollmentNo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, studentSearch, form.department, form.batch]);

  const facultyOptions = useMemo(
    () =>
      form.department
        ? faculty.filter((f) => f.department === form.department)
        : faculty,
    [faculty, form.department]
  );

  const addScheduleRow = () => {
    setForm((f) => ({
      ...f,
      schedule: [
        ...f.schedule,
        {
          day: selectedDay,
          subject: "",
          subjectId: slugSubjectId(`new-${Date.now()}`),
          startTime: "09:00",
          endTime: "10:00",
          room: "",
        },
      ],
    }));
  };

  const validateAndAdvance = () => {
    if (step === 0) {
      if (!form.courseName.trim())
        return toast.error("Course Name is required");
      if (!form.courseCode.trim())
        return toast.error("Course Code is required");
      if (!form.department.trim())
        return toast.error("Department is required");
      if (!form.batch.trim()) return toast.error("Batch is required");
      if (!form.facultyId) return toast.error("Assign a faculty member");
      if (form.credits < 1 || form.credits > 5)
        return toast.error("Credits must be between 1 and 5");
    }
    if (step === 1 && form.schedule.length === 0) {
      return toast.error("Add at least one timetable slot");
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = () => {
    const cleaned = form.schedule.filter((s) => s.subject.trim());
    if (cleaned.length !== form.schedule.length) {
      toast.error("All timetable slots need a subject/paper name");
      return;
    }
    onSave({ ...form, schedule: cleaned }, editCourse?.id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:items-stretch max-md:p-0"
          onClick={(e) => e.target === e.currentTarget && onClose()}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 max-md:max-h-none max-md:h-full max-md:max-w-none max-md:rounded-none"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-white">
                {editCourse ? "Edit Course" : "Add Course"}
              </h2>
              <button type="button" onClick={onClose}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex gap-2 px-6 pt-4">
              {["Course Details", "Timetable", "Enroll Students"].map(
                (label, i) => (
                  <div
                    key={label}
                    className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium ${
                      step === i
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-slate-500"
                    }`}
                  >
                    {label}
                  </div>
                )
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="c1"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        placeholder="Course Name * (e.g. Data Structures)"
                        value={form.courseName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            courseName: e.target.value,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      />
                      <input
                        placeholder="Course Code * (e.g. CS301)"
                        value={form.courseCode}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            courseCode: e.target.value.toUpperCase(),
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        placeholder="Department *"
                        value={form.department}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            department: e.target.value,
                            facultyId: "",
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                        list="dept-options"
                      />
                      <datalist id="dept-options">
                        <option value="Computer Science & Engineering" />
                        <option value="Electronics & Communication" />
                        <option value="Mechanical Engineering" />
                        <option value="Civil Engineering" />
                        <option value="Information Technology" />
                      </datalist>
                      <select
                        value={form.semester}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            semester: e.target.value as Semester,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      >
                        {SEMESTERS.map((s) => (
                          <option key={s} value={s}>
                            {s} Semester
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        placeholder="Batch * (e.g. 2022-2026)"
                        value={form.batch}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, batch: e.target.value }))
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">
                          Credits *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={form.credits}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              credits: Math.max(
                                1,
                                Math.min(5, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                        />
                      </div>
                    </div>

                    <select
                      value={form.facultyId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          facultyId: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    >
                      <option value="">Assign Faculty *</option>
                      {facultyOptions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} · {f.designation} · {f.employeeId}
                        </option>
                      ))}
                    </select>
                    {form.department &&
                      facultyOptions.length === 0 && (
                        <p className="text-xs text-amber-400">
                          No faculty in {form.department}. Add one first or
                          change department.
                        </p>
                      )}
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="c2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <p className="mb-3 text-xs text-slate-400">
                      Add lectures, tutorials and labs to the weekly timetable.
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {DAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDay(d)}
                          className={`rounded-lg px-3 py-1 text-xs ${
                            selectedDay === d
                              ? "bg-indigo-600 text-white"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addScheduleRow}
                      className="mb-3 flex items-center gap-1 text-sm text-indigo-400"
                    >
                      <Plus className="h-4 w-4" /> Add slot for {selectedDay}
                    </button>
                    <div className="space-y-2">
                      {form.schedule.map((slot, i) => (
                        <div
                          key={`${slot.subjectId}-${i}`}
                          className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2"
                        >
                          <select
                            value={slot.day}
                            onChange={(e) => {
                              const schedule = [...form.schedule];
                              schedule[i] = {
                                ...slot,
                                day: e.target.value as ScheduleSlot["day"],
                              };
                              setForm((f) => ({ ...f, schedule }));
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                          >
                            {DAYS.map((d) => (
                              <option key={d} value={d}>
                                {d.slice(0, 3)}
                              </option>
                            ))}
                          </select>
                          <input
                            value={slot.subject}
                            onChange={(e) => {
                              const schedule = [...form.schedule];
                              schedule[i] = {
                                ...slot,
                                subject: e.target.value,
                              };
                              setForm((f) => ({ ...f, schedule }));
                            }}
                            placeholder="Subject / Paper"
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                          />
                          <input
                            value={slot.room ?? ""}
                            onChange={(e) => {
                              const schedule = [...form.schedule];
                              schedule[i] = {
                                ...slot,
                                room: e.target.value,
                              };
                              setForm((f) => ({ ...f, schedule }));
                            }}
                            placeholder="Room / Lab"
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                          />
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => {
                              const schedule = [...form.schedule];
                              schedule[i] = {
                                ...slot,
                                startTime: e.target.value,
                              };
                              setForm((f) => ({ ...f, schedule }));
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                          />
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => {
                              const schedule = [...form.schedule];
                              schedule[i] = {
                                ...slot,
                                endTime: e.target.value,
                              };
                              setForm((f) => ({ ...f, schedule }));
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                schedule: f.schedule.filter(
                                  (_, j) => j !== i
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="c3"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-slate-400">
                        Selected: {form.studentIds.length} students
                        {form.department || form.batch ? (
                          <span className="ml-1 text-xs text-slate-500">
                            (filtered to {form.department || "any dept"} /
                            batch {form.batch || "any"})
                          </span>
                        ) : null}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              studentIds: filteredStudents.map((s) => s.id),
                            }))
                          }
                          className="text-xs text-indigo-300 hover:text-indigo-200"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, studentIds: [] }))
                          }
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <input
                      type="search"
                      placeholder="Search by name or enrollment number…"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    />
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                      {filteredStudents.map((s) => {
                        const inOtherCourse = s.courseIds.some(
                          (cid) => cid !== editCourse?.id
                        );
                        return (
                          <label
                            key={s.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                          >
                            <input
                              type="checkbox"
                              checked={form.studentIds.includes(s.id)}
                              onChange={(e) => {
                                setForm((f) => ({
                                  ...f,
                                  studentIds: e.target.checked
                                    ? [...f.studentIds, s.id]
                                    : f.studentIds.filter(
                                        (id) => id !== s.id
                                      ),
                                }));
                              }}
                            />
                            <span className="text-sm text-white">
                              {s.name}
                            </span>
                            <span className="font-mono text-xs text-slate-500">
                              {s.enrollmentNo}
                            </span>
                            {inOtherCourse && (
                              <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-300">
                                in other course(s)
                              </span>
                            )}
                          </label>
                        );
                      })}
                      {filteredStudents.length === 0 && (
                        <p className="py-4 text-center text-xs text-slate-500">
                          No students match this department/batch yet.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-between border-t border-white/10 px-6 py-4">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
              >
                Back
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  onClick={validateAndAdvance}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Course
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
