"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, ChevronLeft, ChevronRight, X } from "lucide-react";

const FaceScanner = dynamic(
  () =>
    import("@/components/attendance/FaceScanner").then((m) => m.FaceScanner),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-slate-400">Loading camera…</p>
    ),
  }
);
import type { Course, Semester, Student } from "@/types";

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

export interface StudentFormData {
  name: string;
  enrollmentNo: string;
  email: string;
  phone: string;
  department: string;
  semester: Semester;
  batch: string;
  courseIds: string[];
  photoURL: string;
  faceDescriptor: number[] | null;
  isActive: boolean;
}

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: StudentFormData, id?: string) => void;
  courses: Course[];
  editStudent?: Student | null;
}

const emptyForm: StudentFormData = {
  name: "",
  enrollmentNo: "",
  email: "",
  phone: "",
  department: "",
  semester: "1st",
  batch: "",
  courseIds: [],
  photoURL: "",
  faceDescriptor: null,
  isActive: true,
};

export function AddStudentModal({
  open,
  onClose,
  onSave,
  courses,
  editStudent,
}: AddStudentModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<StudentFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFaceScanner, setShowFaceScanner] = useState(false);

  const reset = () => {
    setStep(0);
    setErrors({});
    setShowFaceScanner(false);
    if (editStudent) {
      setForm({
        name: editStudent.name,
        enrollmentNo: editStudent.enrollmentNo,
        email: editStudent.email,
        phone: editStudent.phone ?? "",
        department: editStudent.department,
        semester: editStudent.semester,
        batch: editStudent.batch,
        courseIds: [...editStudent.courseIds],
        photoURL: editStudent.photoURL,
        faceDescriptor: editStudent.faceDescriptor,
        isActive: editStudent.isActive,
      });
    } else {
      setForm(emptyForm);
    }
  };

  useEffect(() => {
    if (open) reset();
  }, [open, editStudent?.id]);

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.enrollmentNo.trim())
      e.enrollmentNo = "Enrollment number is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Valid email is required";
    if (!form.department.trim()) e.department = "Department is required";
    if (!form.batch.trim()) e.batch = "Batch is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photoURL: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave(form, editStudent?.id);
    onClose();
    setForm(emptyForm);
    setStep(0);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const matchingCourses = courses.filter(
    (c) =>
      (form.department ? c.department === form.department : true) &&
      (form.semester ? c.semester === form.semester : true) &&
      (form.batch ? c.batch === form.batch : true)
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:items-stretch max-md:p-0"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 max-md:max-h-none max-md:h-full max-md:max-w-none max-md:rounded-none"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-white">
            {editStudent ? "Edit Student" : "Add Student"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {["Personal Info", "Photo & Face", "Enroll in Courses"].map(
            (label, i) => (
              <div
                key={label}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium ${
                  step === i
                    ? "bg-indigo-600 text-white"
                    : step > i
                      ? "bg-indigo-600/30 text-indigo-300"
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
                key="s1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Full Name *
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Enrollment No *
                    </label>
                    <input
                      value={form.enrollmentNo}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          enrollmentNo: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-white"
                      placeholder="CSE22001"
                    />
                    {errors.enrollmentNo && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors.enrollmentNo}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Department *
                    </label>
                    <input
                      value={form.department}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, department: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                      list="dept-options-add"
                    />
                    <datalist id="dept-options-add">
                      <option value="Computer Science & Engineering" />
                      <option value="Electronics & Communication" />
                      <option value="Mechanical Engineering" />
                      <option value="Civil Engineering" />
                      <option value="Information Technology" />
                    </datalist>
                    {errors.department && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors.department}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">
                      Semester *
                    </label>
                    <select
                      value={form.semester}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          semester: e.target.value as Semester,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    >
                      {SEMESTERS.map((s) => (
                        <option key={s} value={s}>
                          {s} Semester
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Batch *
                  </label>
                  <input
                    value={form.batch}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, batch: e.target.value }))
                    }
                    placeholder="e.g. 2022-2026"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                  />
                  {errors.batch && (
                    <p className="mt-1 text-xs text-red-400">{errors.batch}</p>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                    className="rounded"
                  />
                  Active student
                </label>
              </motion.div>
            )}

            {step === 1 && !showFaceScanner && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handlePhotoUpload(file);
                  }}
                  className="flex flex-col items-center rounded-2xl border-2 border-dashed border-white/15 p-8"
                >
                  {form.photoURL ? (
                    <img
                      src={form.photoURL}
                      alt=""
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-slate-500">
                      <Camera className="h-8 w-8" />
                    </div>
                  )}
                  <label className="mt-4 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFaceScanner(true)}
                  className="w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10 py-3 text-sm font-medium text-indigo-300"
                >
                  Enroll Face
                </button>
                <p
                  className={`text-center text-sm ${
                    form.faceDescriptor ? "text-green-400" : "text-slate-500"
                  }`}
                >
                  {form.faceDescriptor ? (
                    <span className="flex items-center justify-center gap-1">
                      <Check className="h-4 w-4" /> Face enrolled
                    </span>
                  ) : (
                    "Not enrolled"
                  )}
                </p>
              </motion.div>
            )}

            {step === 1 && showFaceScanner && (
              <motion.div
                key="face"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <FaceScanner
                  mode="enroll"
                  onEnrollComplete={(descriptor, photo) => {
                    setForm((f) => ({
                      ...f,
                      faceDescriptor: descriptor,
                      photoURL: photo || f.photoURL,
                    }));
                    setShowFaceScanner(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowFaceScanner(false)}
                  className="mt-2 text-sm text-slate-400"
                >
                  ← Back to upload
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3 text-sm"
              >
                <p className="text-xs text-slate-400">
                  Pick the courses to enroll this student in. Showing only
                  courses matching department / semester / batch.
                </p>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                  {matchingCourses.length === 0 && (
                    <p className="py-3 text-center text-xs text-slate-500">
                      No matching courses for{" "}
                      {form.department || "this department"} ·{" "}
                      {form.semester} Sem · Batch {form.batch || "?"}
                    </p>
                  )}
                  {matchingCourses.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={form.courseIds.includes(c.id)}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            courseIds: e.target.checked
                              ? [...f.courseIds, c.id]
                              : f.courseIds.filter((id) => id !== c.id),
                          }));
                        }}
                      />
                      <span className="font-mono text-xs text-indigo-300">
                        {c.courseCode}
                      </span>
                      <span className="text-sm text-white">
                        {c.courseName}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-500">
                        {c.credits} cr
                      </span>
                    </label>
                  ))}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400">
                  <p>
                    <span className="text-slate-500">Name:</span>{" "}
                    <span className="text-white">{form.name}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Enrollment:</span>{" "}
                    <span className="text-white font-mono">
                      {form.enrollmentNo}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Department:</span>{" "}
                    <span className="text-white">{form.department}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Semester / Batch:</span>{" "}
                    <span className="text-white">
                      {form.semester} · {form.batch}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Face:</span>{" "}
                    <span
                      className={
                        form.faceDescriptor
                          ? "text-green-400"
                          : "text-slate-400"
                      }
                    >
                      {form.faceDescriptor ? "Enrolled" : "Not enrolled"}
                    </span>
                  </p>
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
            className="flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 0 && !validateStep1()) return;
                setStep((s) => s + 1);
              }}
              className="flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save Student
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
