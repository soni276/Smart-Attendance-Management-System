"use client";

import { useState } from "react";
import Papa, { type ParseResult } from "papaparse";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import { generateId } from "@/lib/utils";
import type { ClassRoom, Student } from "@/types";

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  classes: ClassRoom[];
  onImport: (students: Student[]) => { imported: number; failed: { row: number; reason: string }[] };
}

export function CsvImportModal({
  open,
  onClose,
  classes,
  onImport,
}: CsvImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    imported: number;
    failed: { row: number; reason: string }[];
  } | null>(null);

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  const autoMap = (hdrs: string[]) => {
    const m: Record<string, string> = {};
    const lower = (s: string) => s.toLowerCase().replace(/\s/g, "");
    hdrs.forEach((h) => {
      const l = lower(h);
      if (l.includes("name")) m.name = h;
      if (l.includes("roll")) m.rollNo = h;
      if (l.includes("email")) m.email = h;
      if (l.includes("class")) m.className = h;
      if (l.includes("section")) m.section = h;
    });
    setMapping(m);
  };

  const parseFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res: ParseResult<Record<string, string>>) => {
        setRows(res.data);
        if (res.meta.fields) autoMap(res.meta.fields);
        setResult(null);
      },
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    const toCreate: Student[] = [];
    const failed: { row: number; reason: string }[] = [];

    const existing = (
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("sas_students") ?? "[]")
        : []
    ) as Student[];
    const seenRolls = new Set<string>(
      existing.map((s) => s.rollNo.toLowerCase())
    );
    const seenEmails = new Set<string>(
      existing.map((s) => s.email.toLowerCase())
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row[mapping.name] ?? "").trim();
      const rollNo = (row[mapping.rollNo] ?? "").trim();
      const email = (row[mapping.email] ?? "").trim();
      const className = (row[mapping.className] ?? "").trim();
      const section = (row[mapping.section] ?? "").trim();

      if (!name || !rollNo || !email) {
        failed.push({ row: i + 1, reason: "Missing required fields" });
        continue;
      }

      if (seenRolls.has(rollNo.toLowerCase())) {
        failed.push({
          row: i + 1,
          reason: `Duplicate roll number: ${rollNo}`,
        });
        continue;
      }
      if (seenEmails.has(email.toLowerCase())) {
        failed.push({ row: i + 1, reason: `Duplicate email: ${email}` });
        continue;
      }

      if (!className) {
        failed.push({ row: i + 1, reason: "Class column is empty" });
        continue;
      }

      const cls = classes.find(
        (c) =>
          c.name.toLowerCase() === className.toLowerCase() ||
          (className && c.name.toLowerCase().includes(className.toLowerCase()))
      );

      if (!cls) {
        failed.push({ row: i + 1, reason: `Class not found: ${className}` });
        continue;
      }

      seenRolls.add(rollNo.toLowerCase());
      seenEmails.add(email.toLowerCase());

      toCreate.push({
        id: generateId(),
        name,
        rollNo,
        email,
        classId: cls.id,
        section: section || cls.section,
        department: cls.department,
        photoURL: "",
        faceDescriptor: null,
        enrolledAt: new Date().toISOString(),
        isActive: true,
      });

      setProgress(Math.round(((i + 1) / rows.length) * 100));
      await new Promise((r) => setTimeout(r, 10));
    }

    const res = onImport(toCreate);
    setResult({
      imported: res.imported,
      failed: [...failed, ...res.failed],
    });
    setImporting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm max-md:items-stretch max-md:p-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 max-md:max-h-none max-md:h-full max-md:max-w-none max-md:rounded-none"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Import CSV
          </h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!result && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) parseFile(f);
              }}
              className="flex flex-col items-center rounded-2xl border-2 border-dashed border-white/15 p-10"
            >
              <Upload className="h-10 w-10 text-slate-500" />
              <label className="mt-4 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">
                Choose CSV file
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) parseFile(f);
                  }}
                />
              </label>
            </div>
          )}

          {rows.length > 0 && !result && (
            <>
              <p className="text-sm text-slate-400">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/5">
                      {headers.slice(0, 6).map((h) => (
                        <th key={h} className="p-2 text-left text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-white/5">
                        {headers.slice(0, 6).map((h) => (
                          <td key={h} className="p-2 text-slate-300">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(["name", "rollNo", "email", "className", "section"] as const).map(
                  (field) => (
                    <div key={field}>
                      <label className="text-xs text-slate-500">{field}</label>
                      <select
                        value={mapping[field] ?? ""}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [field]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                      >
                        <option value="">—</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>

              {importing && (
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <button
                type="button"
                disabled={importing || !mapping.name}
                onClick={handleImport}
                className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                Import {rows.length} Students
              </button>
            </>
          )}

          {result && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-green-400">{result.imported} imported</p>
              {result.failed.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto text-red-300">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      Row {f.row}: {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
