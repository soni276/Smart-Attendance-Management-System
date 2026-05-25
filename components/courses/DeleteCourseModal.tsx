"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import type { Course } from "@/types";

interface DeleteCourseModalProps {
  course: Course | null;
  studentCount: number;
  recordCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCourseModal({
  course,
  studentCount,
  recordCount,
  onClose,
  onConfirm,
}: DeleteCourseModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (course) setConfirmText("");
  }, [course?.id]);

  useEffect(() => {
    if (!course) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [course, onClose]);

  const expected = course?.courseCode ?? "";
  const matches = confirmText.trim().toUpperCase() === expected.toUpperCase();

  return (
    <AnimatePresence>
      {course && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: shake ? [0, -8, 8, -8, 8, 0] : 0,
            }}
            transition={{ x: { duration: 0.4 } }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/20 bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <h2 className="font-display text-lg font-semibold text-white">
                  Delete course
                </h2>
              </div>
              <button type="button" onClick={onClose}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-5">
              <p className="text-sm text-slate-300">
                You are about to permanently delete{" "}
                <span className="font-semibold text-white">
                  {course.courseCode} · {course.courseName}
                </span>
                .
              </p>
              <ul className="space-y-1 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-rose-200">
                <li>
                  {studentCount} student{studentCount === 1 ? "" : "s"} will be
                  unenrolled from this course
                </li>
                <li>
                  {recordCount} attendance record
                  {recordCount === 1 ? "" : "s"} will remain (orphaned)
                </li>
                <li>This action cannot be undone</li>
              </ul>
              <p className="text-xs text-slate-400">
                Type the course code{" "}
                <span className="font-mono font-bold text-red-300">
                  {expected}
                </span>{" "}
                to confirm:
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expected}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-red-500/50"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!matches) {
                    setShake(true);
                    setTimeout(() => setShake(false), 400);
                    return;
                  }
                  onConfirm();
                }}
                disabled={!matches}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40 hover:bg-red-500"
              >
                Delete course
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
