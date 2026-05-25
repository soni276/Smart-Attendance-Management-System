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
import type { ClassRoom, Student } from "@/types";

export interface StudentFormData {
  name: string;
  rollNo: string;
  email: string;
  phone: string;
  classId: string;
  section: string;
  department: string;
  photoURL: string;
  faceDescriptor: number[] | null;
  isActive: boolean;
}

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: StudentFormData, id?: string) => void;
  classes: ClassRoom[];
  editStudent?: Student | null;
}

const emptyForm: StudentFormData = {
  name: "",
  rollNo: "",
  email: "",
  phone: "",
  classId: "",
  section: "",
  department: "",
  photoURL: "",
  faceDescriptor: null,
  isActive: true,
};

export function AddStudentModal({
  open,
  onClose,
  onSave,
  classes,
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
        rollNo: editStudent.rollNo,
        email: editStudent.email,
        phone: editStudent.phone ?? "",
        classId: editStudent.classId,
        section: editStudent.section,
        department: editStudent.department,
        photoURL: editStudent.photoURL,
        faceDescriptor: editStudent.faceDescriptor,
        isActive: editStudent.isActive,
      });
    } else {
      setForm(emptyForm);
    }
  };

  const handleOpen = () => {
    reset();
  };

  useEffect(() => {
    if (open) handleOpen();
  }, [open, editStudent?.id]);

  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.rollNo.trim()) e.rollNo = "Roll number is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Valid email is required";
    if (!form.classId) e.classId = "Class is required";
    if (!form.section.trim()) e.section = "Section is required";
    if (!form.department.trim()) e.department = "Department is required";
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
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {["Basic Info", "Photo & Face", "Review"].map((label, i) => (
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
          ))}
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
                {(
                  [
                    ["name", "Name *", "text"],
                    ["rollNo", "Roll No *", "text"],
                    ["email", "Email *", "email"],
                    ["phone", "Phone", "tel"],
                  ] as const
                ).map(([key, label, type]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-slate-500">{label}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-indigo-500/50"
                    />
                    {errors[key] && (
                      <p className="mt-1 text-xs text-red-400">{errors[key]}</p>
                    )}
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Class *</label>
                  <select
                    value={form.classId}
                    onChange={(e) => {
                      const cls = classes.find((c) => c.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        classId: e.target.value,
                        section: cls?.section ?? f.section,
                        department: cls?.department ?? f.department,
                      }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.classId && (
                    <p className="mt-1 text-xs text-red-400">{errors.classId}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Section *</label>
                    <input
                      value={form.section}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, section: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    />
                    {errors.section && (
                      <p className="mt-1 text-xs text-red-400">{errors.section}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Department *</label>
                    <input
                      value={form.department}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, department: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
                    />
                    {errors.department && (
                      <p className="mt-1 text-xs text-red-400">{errors.department}</p>
                    )}
                  </div>
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
                      <Check className="h-4 w-4" /> Face enrolled ✓
                    </span>
                  ) : (
                    "Not enrolled"
                  )}
                </p>
              </motion.div>
            )}

            {step === 1 && showFaceScanner && (
              <motion.div key="face" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                <p>
                  <span className="text-slate-500">Name:</span>{" "}
                  <span className="text-white">{form.name}</span>
                </p>
                <p>
                  <span className="text-slate-500">Roll:</span>{" "}
                  <span className="text-white">{form.rollNo}</span>
                </p>
                <p>
                  <span className="text-slate-500">Email:</span>{" "}
                  <span className="text-white">{form.email}</span>
                </p>
                <p>
                  <span className="text-slate-500">Class:</span>{" "}
                  <span className="text-white">
                    {classes.find((c) => c.id === form.classId)?.name}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Face:</span>{" "}
                  <span className={form.faceDescriptor ? "text-green-400" : "text-slate-400"}>
                    {form.faceDescriptor ? "Enrolled" : "Not enrolled"}
                  </span>
                </p>
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
