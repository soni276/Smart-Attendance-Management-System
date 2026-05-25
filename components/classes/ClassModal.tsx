"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { slugSubjectId } from "@/lib/student-helpers";
import type { ClassRoom, ScheduleSlot, Student, Teacher } from "@/types";

const DAYS: ScheduleSlot["day"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface ClassFormData {
  name: string;
  section: string;
  department: string;
  teacherId: string;
  schedule: ScheduleSlot[];
  studentIds: string[];
}

interface ClassModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ClassFormData, id?: string) => void;
  teachers: Teacher[];
  students: Student[];
  editClass?: ClassRoom | null;
}

const empty: ClassFormData = {
  name: "",
  section: "",
  department: "",
  teacherId: "",
  schedule: [],
  studentIds: [],
};

export function ClassModal({
  open,
  onClose,
  onSave,
  teachers,
  students,
  editClass,
}: ClassModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClassFormData>(empty);
  const [selectedDay, setSelectedDay] = useState<ScheduleSlot["day"]>("Monday");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (editClass) {
      setForm({
        name: editClass.name,
        section: editClass.section,
        department: editClass.department,
        teacherId: editClass.teacherId,
        schedule: [...editClass.schedule],
        studentIds: [...editClass.studentIds],
      });
    } else {
      setForm(empty);
    }
  }, [open, editClass]);

  const [studentSearch, setStudentSearch] = useState("");

  const unassignedStudents = students.filter(
    (s) => !form.studentIds.includes(s.id) && s.isActive
  );

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = students.filter((s) => s.isActive);
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

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
        },
      ],
    }));
  };

  const validateAndAdvance = () => {
    if (step === 0) {
      if (!form.name.trim()) return toast.error("Class name is required");
      if (!form.section.trim()) return toast.error("Section is required");
      if (!form.department.trim()) return toast.error("Department is required");
      if (!form.teacherId) return toast.error("Assign a teacher");
    }
    if (step === 1 && form.schedule.length === 0) {
      return toast.error("Add at least one schedule slot");
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = () => {
    const cleaned = form.schedule.filter((s) => s.subject.trim());
    if (cleaned.length !== form.schedule.length) {
      toast.error("All schedule slots need a subject name");
      return;
    }
    onSave({ ...form, schedule: cleaned }, editClass?.id);
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
            {editClass ? "Edit Class" : "Add Class"}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {["Details", "Schedule", "Students"].map((label, i) => (
            <div
              key={label}
              className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium ${
                step === i ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-500"
              }`}
            >
              {label}
            </div>
          ))}
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
                <input
                  placeholder="Class name *"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Section *"
                    value={form.section}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, section: e.target.value }))
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                  />
                  <input
                    placeholder="Department *"
                    value={form.department}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, department: e.target.value }))
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                  />
                </div>
                <select
                  value={form.teacherId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, teacherId: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                >
                  <option value="">Assign teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="c2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
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
                      key={slot.subjectId}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2"
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
                        placeholder="Subject"
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                      />
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => {
                          const schedule = [...form.schedule];
                          schedule[i] = { ...slot, startTime: e.target.value };
                          setForm((f) => ({ ...f, schedule }));
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                      />
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => {
                          const schedule = [...form.schedule];
                          schedule[i] = { ...slot, endTime: e.target.value };
                          setForm((f) => ({ ...f, schedule }));
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            schedule: f.schedule.filter((_, j) => j !== i),
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
              <motion.div key="c3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-400">
                    Selected: {form.studentIds.length} students
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
                      onClick={() => setForm((f) => ({ ...f, studentIds: [] }))}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <input
                  type="search"
                  placeholder="Search students…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                />
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                  {filteredStudents.map((s) => {
                    const inOtherClass =
                      s.classId && s.classId !== editClass?.id;
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
                                : f.studentIds.filter((id) => id !== s.id),
                            }));
                          }}
                        />
                        <span className="text-sm text-white">{s.name}</span>
                        <span className="text-xs text-slate-500">{s.rollNo}</span>
                        {inOtherClass && (
                          <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                            in another class
                          </span>
                        )}
                      </label>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No students match.
                    </p>
                  )}
                </div>
                {unassignedStudents.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {unassignedStudents.length} students not yet in this class
                  </p>
                )}
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
              Save Class
            </button>
          )}
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
