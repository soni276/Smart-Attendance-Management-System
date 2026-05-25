"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
const FaceScanner = dynamic(
  () =>
    import("@/components/attendance/FaceScanner").then((m) => m.FaceScanner),
  { ssr: false, loading: () => (
    <div className="flex flex-1 items-center justify-center py-12">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
    </div>
  ) }
);
import { buildClientStoreSnapshot } from "@/lib/client-store";
import { KEYS, getAll, getSettings, save } from "@/lib/storage";
import {
  cn,
  formatTime,
  generateId,
  getStatusColor,
} from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  QRPayload,
  QRSession,
  Student,
} from "@/types";

type FlowState =
  | "validating"
  | "student-select"
  | "geo-checking"
  | "qr-valid"
  | "face-scanning"
  | "liveness"
  | "success"
  | "error";

type StepKey = "qr" | "location" | "face" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "qr", label: "QR" },
  { key: "location", label: "Location" },
  { key: "face", label: "Face" },
  { key: "done", label: "Done" },
];

const CONFETTI_COLORS = [
  "#6366f1",
  "#22d3ee",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#a855f7",
];

function parseQrString(raw: string): QRPayload | null {
  try {
    return JSON.parse(decodeURIComponent(raw)) as QRPayload;
  } catch {
    try {
      return JSON.parse(raw) as QRPayload;
    } catch {
      return null;
    }
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function geoDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isRetryableError(msg: string): boolean {
  return (
    msg.toLowerCase().includes("expired") ||
    msg.toLowerCase().includes("outdated") ||
    msg.toLowerCase().includes("invalid qr")
  );
}

function upsertSession(session: QRSession): void {
  const all = getAll<QRSession>(KEYS.QR_SESSIONS);
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.push(session);
  localStorage.setItem(KEYS.QR_SESSIONS, JSON.stringify(all));
}

function ProgressStepper({
  current,
  geoEnabled,
}: {
  current: StepKey;
  geoEnabled: boolean;
}) {
  const steps = geoEnabled
    ? STEPS
    : STEPS.filter((s) => s.key !== "location");

  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-bold transition",
                done && "bg-indigo-600 text-white",
                active && "animate-pulse bg-indigo-500/30 text-indigo-300 ring-2 ring-indigo-500",
                !done && !active && "bg-white/10 text-slate-500"
              )}
            >
              {done ? "✓" : step.label}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-4",
                  done ? "bg-indigo-500" : "bg-white/10"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${2.5 + Math.random() * 2}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

function GeoFenceVisual({
  userLat,
  userLng,
  centerLat,
  centerLng,
  radiusM,
}: {
  userLat?: number;
  userLng?: number;
  centerLat: number;
  centerLng: number;
  radiusM: number;
}) {
  const distance =
    userLat !== undefined && userLng !== undefined
      ? Math.round(geoDistanceMeters(userLat, userLng, centerLat, centerLng))
      : null;

  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
      <div className="absolute h-40 w-40 rounded-full border border-indigo-500/30 bg-indigo-500/5" />
      <div className="absolute h-40 w-40 animate-radar-pulse rounded-full border-2 border-indigo-400/50" />
      <div className="absolute h-28 w-28 rounded-full border border-cyan-500/40 bg-cyan-500/10" />
      <div className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 shadow-lg shadow-indigo-500/40">
        <MapPin className="h-5 w-5 text-white" />
      </div>
      {userLat !== undefined && (
        <div
          className="absolute h-4 w-4 rounded-full border-2 border-white bg-green-400 shadow"
          style={{ top: "20%", right: "22%" }}
          title="Your location"
        />
      )}
      <p className="absolute -bottom-8 w-full text-center text-sm text-slate-400">
        {distance !== null
          ? `You are ${distance}m from classroom (max ${radiusM}m allowed)`
          : `Classroom zone · max ${radiusM}m`}
      </p>
    </div>
  );
}

function ScanPageContent() {
  const searchParams = useSearchParams();
  const qrParam = searchParams.get("qr") ?? "";
  const studentIdParam = searchParams.get("studentId") ?? "";

  const settings = getSettings();
  const geoEnabled = settings.geoFencingEnabled;

  const [flow, setFlow] = useState<FlowState>("student-select");
  const [qrString, setQrString] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(studentIdParam);
  const [sessionId, setSessionId] = useState("");
  const [sessionMeta, setSessionMeta] = useState<QRSession | null>(null);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [search, setSearch] = useState("");
  const [geoCoords, setGeoCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [markResult, setMarkResult] = useState<{
    status: AttendanceRecord["status"];
    markedAt: string;
    latenessMinutes?: number;
  } | null>(null);
  const [confirmPending, setConfirmPending] = useState(!!studentIdParam);

  const qrPayload = useMemo(
    () => (qrString ? parseQrString(qrString) : null),
    [qrString]
  );

  const classStudents = useMemo(() => {
    if (!qrPayload) return [];
    return getAll<Student>(KEYS.STUDENTS).filter(
      (s) => s.classId === qrPayload.classId && s.isActive
    );
  }, [qrPayload, flow]);

  const selectedStudent = useMemo(
    () => classStudents.find((s) => s.id === selectedStudentId) ?? null,
    [classStudents, selectedStudentId]
  );

  const classRoom = useMemo(() => {
    if (!qrPayload) return null;
    return (
      getAll<ClassRoom>(KEYS.CLASSES).find((c) => c.id === qrPayload.classId) ??
      null
    );
  }, [qrPayload]);

  const classLabel =
    sessionMeta?.className ?? classRoom?.name ?? "Your class";

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q)
    );
  }, [classStudents, search]);

  const currentStep = useMemo((): StepKey => {
    if (flow === "success") return "done";
    if (flow === "face-scanning" || flow === "liveness") return "face";
    if (flow === "geo-checking") return "location";
    if (flow === "qr-valid" || flow === "validating") return "qr";
    return "qr";
  }, [flow]);

  useEffect(() => {
    if (!qrParam) {
      setError("No QR code found. Please scan the classroom QR again.");
      setRetryable(false);
      setFlow("error");
      return;
    }
    setQrString(qrParam);

    if (!studentIdParam) {
      setFlow("student-select");
    } else {
      setSelectedStudentId(studentIdParam);
      setConfirmPending(true);
    }
  }, [qrParam, studentIdParam]);

  const validateQR = useCallback(async () => {
    if (!qrString || !selectedStudentId) return;

    setFlow("validating");
    setError("");

    let lat: number | undefined;
    let lng: number | undefined;

    if (geoEnabled) {
      setFlow("geo-checking");
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setGeoCoords({ lat, lng });
      } catch {
        setError(
          "Location access is required. Please enable GPS and try again."
        );
        setRetryable(true);
        setFlow("error");
        return;
      }
    }

    try {
      const res = await fetch("/api/qr/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrString,
          studentId: selectedStudentId,
          geoLat: lat,
          geoLng: lng,
          _store: buildClientStoreSnapshot(),
        }),
      });

      const data = await res.json();

      if (!data.valid) {
        setError(data.error ?? "QR validation failed");
        setRetryable(isRetryableError(data.error ?? ""));
        setFlow("error");
        return;
      }

      setSessionId(data.sessionId);
      const sessions = getAll<QRSession>(KEYS.QR_SESSIONS);
      let session: QRSession | null =
        (data.session as QRSession | undefined) ??
        sessions.find((s) => s.id === data.sessionId) ??
        null;
      if (!session && qrPayload) {
        session = {
          id: data.sessionId,
          classId: qrPayload.classId,
          subjectId: qrPayload.subjectId,
          subject: "",
          teacherId: qrPayload.teacherId,
          teacherName: "",
          className: classRoom?.name ?? "",
          date: new Date().toISOString().slice(0, 10),
          windowSlot: qrPayload.windowSlot,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          lateAfterMinutes: 10,
          absentAfterMinutes: 25,
          isActive: true,
          markedStudentIds: [],
          currentNonce: qrPayload.nonce,
          currentSignature: qrPayload.signature,
          lastRotatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
      }
      if (session) upsertSession(session);
      setSessionMeta(session);

      setFlow("qr-valid");
      setTimeout(() => setFlow("face-scanning"), 1500);
    } catch {
      setError("Network error. Check your connection and try again.");
      setRetryable(true);
      setFlow("error");
    }
  }, [qrString, selectedStudentId, geoEnabled]);

  const handleConfirmStudent = () => {
    setConfirmPending(false);
    validateQR();
  };

  const handleVerifyComplete = async (
    matched: boolean,
    matchedId?: string
  ) => {
    if (!matched || !matchedId) {
      setError("Face not recognized. Please try again in good lighting.");
      setRetryable(true);
      setFlow("error");
      return;
    }

    if (matchedId !== selectedStudentId) {
      setError("Face doesn't match your profile. Please use your own device.");
      setRetryable(false);
      setFlow("error");
      return;
    }

    setFlow("validating");

    try {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          studentId: selectedStudentId,
          livenessVerified: true,
          _store: buildClientStoreSnapshot(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to mark attendance");
        setRetryable(isRetryableError(data.error ?? ""));
        setFlow("error");
        return;
      }

      if (data.session) upsertSession(data.session);

      const session =
        data.session ??
        getAll<QRSession>(KEYS.QR_SESSIONS).find((s) => s.id === sessionId);

      if (session) {
        save(KEYS.ATTENDANCE, {
          id: generateId(),
          studentId: selectedStudentId,
          classId: session.classId,
          subjectId: session.subjectId,
          date: session.date,
          status: data.status,
          markedBy: session.teacherId,
          markedAt: data.markedAt,
          method: "face-qr",
          ...(data.status === "late" && session
            ? {
                latenessMinutes: Math.max(
                  0,
                  Math.round(
                    (Date.now() - new Date(session.startTime).getTime()) /
                      60000 -
                      session.lateAfterMinutes
                  )
                ),
              }
            : {}),
        });
      }

      setMarkResult({
        status: data.status,
        markedAt: data.markedAt,
        latenessMinutes:
          data.status === "late" && session
            ? Math.max(
                0,
                Math.round(
                  (new Date(data.markedAt).getTime() -
                    new Date(session.startTime).getTime()) /
                    60000 -
                    session.lateAfterMinutes
                )
              )
            : undefined,
      });
      setFlow("success");
    } catch {
      setError("Failed to submit attendance. Please try again.");
      setRetryable(true);
      setFlow("error");
    }
  };

  const handleRetry = () => {
    setError("");
    if (!selectedStudentId) {
      setFlow("student-select");
      return;
    }
    if (confirmPending) {
      setFlow("student-select");
      return;
    }
    validateQR();
  };

  const verifyStudents = classStudents;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-gradient-to-b from-slate-950 via-indigo-950/40 to-slate-950">
      <ProgressStepper current={currentStep} geoEnabled={geoEnabled} />

      <div className="flex flex-1 flex-col px-4 pb-8 pt-2">
        <AnimatePresence mode="wait">
          {flow === "student-select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col"
            >
              <h1 className="font-display text-center text-2xl font-bold text-white">
                Who are you?
              </h1>
              <p className="mt-2 text-center text-sm text-slate-400">
                Search by name or roll number
              </p>

              <div className="relative mt-6">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students…"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-base text-white outline-none focus:border-indigo-500/50"
                />
              </div>

              <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
                {filteredStudents.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(s.id);
                        setConfirmPending(true);
                      }}
                      className="flex w-full min-h-[56px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:bg-white/10"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold">
                        {getInitials(s.name)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{s.name}</p>
                        <p className="text-sm text-slate-400">{s.rollNo}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {confirmPending && selectedStudent && flow === "student-select" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm"
            >
              <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6">
                <p className="text-center text-sm text-slate-400">Is this you?</p>
                <div className="mt-4 flex flex-col items-center">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-2xl font-bold">
                    {selectedStudent.photoURL ? (
                      <img
                        src={selectedStudent.photoURL}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(selectedStudent.name)
                    )}
                  </div>
                  <p className="mt-3 font-display text-xl font-semibold text-white">
                    {selectedStudent.name}
                  </p>
                  <p className="text-slate-400">{selectedStudent.rollNo}</p>
                  <p className="text-sm text-indigo-300">{classLabel}</p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId("");
                      setConfirmPending(false);
                    }}
                    className="min-h-[52px] rounded-2xl border border-white/10 py-3 text-base font-medium text-slate-300"
                  >
                    Not Me
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmStudent}
                    className="min-h-[52px] rounded-2xl bg-indigo-600 py-3 text-base font-semibold text-white"
                  >
                    Yes, it&apos;s me
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {(flow === "validating" || flow === "geo-checking") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              {flow === "geo-checking" && geoEnabled ? (
                <>
                  <GeoFenceVisual
                    userLat={geoCoords?.lat}
                    userLng={geoCoords?.lng}
                    centerLat={settings.geoLat}
                    centerLng={settings.geoLng}
                    radiusM={settings.geoRadiusMeters}
                  />
                  <p className="mt-12 text-lg font-medium text-white">
                    Verifying your location…
                  </p>
                </>
              ) : (
                <>
                  <Loader2 className="h-14 w-14 animate-spin text-indigo-400" />
                  <p className="mt-6 text-lg font-medium text-white">
                    Validating QR Code…
                  </p>
                </>
              )}
            </motion.div>
          )}

          {flow === "qr-valid" && (
            <motion.div
              key="qr-valid"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <CheckCircle2 className="h-20 w-20 text-green-400" />
              <h2 className="mt-6 font-display text-2xl font-bold text-white">
                QR Verified ✓
              </h2>
              <p className="mt-2 text-slate-400">Proceed to face scan</p>
            </motion.div>
          )}

          {flow === "face-scanning" && (
            <motion.div
              key="face"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 flex-col"
            >
              <h2 className="mb-4 text-center font-display text-xl font-bold">
                Face verification
              </h2>
              <FaceScanner
                mode="verify"
                livenessRequired
                students={verifyStudents}
                onVerifyComplete={handleVerifyComplete}
              />
            </motion.div>
          )}

          {flow === "success" && markResult && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative flex flex-1 flex-col items-center justify-center text-center"
            >
              <Confetti />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
              >
                <CheckCircle2 className="h-24 w-24 text-green-400" />
              </motion.div>
              <h1 className="mt-6 font-display text-3xl font-bold text-white">
                Attendance Marked!
              </h1>

              <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
                <p className="text-sm text-slate-500">Subject</p>
                <p className="font-medium text-white">
                  {sessionMeta?.subject ?? "—"}
                </p>
                <p className="mt-3 text-sm text-slate-500">Class</p>
                <p className="text-white">{classLabel}</p>
                <p className="mt-3 text-sm text-slate-500">Time</p>
                <p className="text-white">{formatTime(markResult.markedAt)}</p>
                <p className="mt-3 text-sm text-slate-500">Status</p>
                <span
                  className={cn(
                    "inline-block rounded-full px-3 py-1 text-sm font-medium capitalize",
                    getStatusColor(markResult.status)
                  )}
                >
                  {markResult.status}
                </span>
              </div>

              {markResult.status === "late" && markResult.latenessMinutes !== undefined && (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Marked as LATE — arrived {markResult.latenessMinutes} minutes
                  after class started
                </p>
              )}

              <p className="mt-8 text-sm text-slate-500">
                You can close this tab
              </p>
            </motion.div>
          )}

          {flow === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              >
                <XCircle className="h-20 w-20 text-red-400" />
              </motion.div>
              <h2 className="mt-6 font-display text-xl font-bold text-white">
                Something went wrong
              </h2>
              <p className="mt-3 max-w-xs text-base text-slate-400">{error}</p>

              <div className="mt-8 flex w-full flex-col gap-3">
                {retryable && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-base font-semibold text-white"
                  >
                    <RefreshCw className="h-5 w-5" />
                    Try Again
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    (window.location.href = `mailto:?subject=Attendance%20Help&body=${encodeURIComponent(error)}`)
                  }
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-base text-slate-300"
                >
                  <AlertCircle className="h-5 w-5" />
                  Contact Teacher
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        </div>
      }
    >
      <ScanPageContent />
    </Suspense>
  );
}
