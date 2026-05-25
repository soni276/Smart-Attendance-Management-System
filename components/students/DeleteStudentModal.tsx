"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { Student } from "@/types";

interface DeleteStudentModalProps {
  student: Student | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteStudentModal({
  student,
  onClose,
  onConfirm,
}: DeleteStudentModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (student) setConfirmText("");
  }, [student?.id]);

  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [student, onClose]);

  const match = student && confirmText.trim() === student.name;

  const handleConfirm = () => {
    if (!match) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    onConfirm();
    setConfirmText("");
    onClose();
  };

  return (
    <AnimatePresence>
      {student && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:items-stretch max-md:p-0"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
      <motion.div
        animate={shake ? { x: [0, -10, 10, -8, 8, 0] } : {}}
        className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 max-md:max-h-none max-md:h-full max-md:max-w-none max-md:rounded-none"
      >
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-6 w-6" />
          <h3 className="font-display text-lg font-semibold text-white">
            Delete student?
          </h3>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          This will delete all attendance records for{" "}
          <strong className="text-white">{student.name}</strong>.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Type <span className="text-white">{student.name}</span> to confirm
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white"
          placeholder={student.name}
        />
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setConfirmText("");
              onClose();
            }}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white"
          >
            Delete
          </button>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
