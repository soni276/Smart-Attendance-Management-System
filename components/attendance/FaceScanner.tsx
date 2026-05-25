"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  Loader2,
  ScanFace,
  UserCheck,
  XCircle,
} from "lucide-react";
import { LivenessOverlay } from "@/components/attendance/LivenessOverlay";
import {
  calculateCombinedEAR,
  detectFace,
  drawFaceOverlay,
  getFaceDescriptor,
  loadModels,
  matchFace,
  type FaceDetectionResult,
} from "@/lib/faceRecognition";
import { cn } from "@/lib/utils";
import type { LivenessChallenge, Student } from "@/types";

type ScannerStatus =
  | "idle"
  | "loading-models"
  | "ready"
  | "scanning"
  | "liveness"
  | "matched"
  | "failed"
  | "enrolled";

interface FaceScannerProps {
  mode: "enroll" | "verify";
  onEnrollComplete?: (descriptor: number[], photoBase64: string) => void;
  onVerifyComplete?: (
    matched: boolean,
    studentId?: string,
    confidence?: number
  ) => void;
  students?: Student[];
  livenessRequired?: boolean;
}

const CHALLENGE_POOL: Array<{
  type: LivenessChallenge["type"];
  instruction: string;
}> = [
  { type: "blink", instruction: "Please blink twice slowly" },
  { type: "blink", instruction: "Please blink twice slowly" },
  { type: "turn-left", instruction: "Turn your head slowly to the left" },
  { type: "smile", instruction: "Smile naturally for the camera" },
];

function buildLivenessSteps(): LivenessChallenge[] {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((c) => ({
    type: c.type,
    instruction: c.instruction,
    completed: false,
  }));
}

function capturePhotoBase64(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function FaceScanner({
  mode,
  onEnrollComplete,
  onVerifyComplete,
  students = [],
  livenessRequired = true,
}: FaceScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [detectedName, setDetectedName] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [livenessStep, setLivenessStep] = useState<LivenessChallenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState("");
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const earHistoryRef = useRef<number[]>([]);
  const earWasLowRef = useRef(false);
  const livenessCompleteRef = useRef(false);
  const livenessStartedRef = useRef(false);
  const verifyingRef = useRef(false);
  const statusRef = useRef<ScannerStatus>("idle");

  statusRef.current = status;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // 1. Load face-api.js weights (idempotent — re-runs are cheap).
      setStatus("loading-models");
      setError("");
      try {
        await loadModels();
      } catch (modelErr) {
        console.error("[FaceScanner] model load failed:", modelErr);
        setError(
          "Failed to load face recognition models. Please check your connection and try again."
        );
        setStatus("failed");
        return;
      }
      setStatus("ready");

      // 2. Try a sequence of getUserMedia constraints. Mobile Safari is picky:
      // `exact` fails on devices without a front camera, so we fall back.
      let stream: MediaStream | null = null;
      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { exact: "user" },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        },
        { video: { facingMode: "user" }, audio: false },
        { video: true, audio: false },
      ];

      let lastErr: unknown = null;
      for (const constraint of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!stream) {
        const e = lastErr as { name?: string; message?: string } | null;
        if (e?.name === "NotAllowedError") {
          setError(
            "Camera permission denied. Please allow camera access in your browser settings and tap Try Again."
          );
        } else if (e?.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError(
            "Could not access camera. Please check permissions and try again."
          );
        }
        setStatus("failed");
        return;
      }

      streamRef.current = stream;

      // 3. Wire stream to <video> and wait for it to actually start playing.
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        setError("Video element not ready. Please retry.");
        setStatus("failed");
        return;
      }

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Video load timeout")),
          15000
        );
        const onReady = () => {
          clearTimeout(timer);
          video
            .play()
            .then(() => resolve())
            .catch(reject);
        };
        if (video.readyState >= 1) {
          onReady();
        } else {
          video.onloadedmetadata = onReady;
        }
      });

      setStatus("scanning");
    } catch (err) {
      console.error("[FaceScanner] camera error:", err);
      const e = err as { name?: string; message?: string };
      if (e.name === "NotAllowedError") {
        setError(
          "Camera permission denied. Please allow camera access and try again."
        );
      } else if (e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError(
          "Camera failed to start: " + (e.message || "Unknown error")
        );
      }
      setStatus("failed");
    }
  }, []);

  const markChallengeComplete = useCallback(() => {
    setBlinkCount(0);
    earWasLowRef.current = false;
    earHistoryRef.current = [];

    setLivenessStep((prev) => {
      const next = [...prev];
      const idx = currentChallengeIndex;
      if (next[idx]) {
        next[idx] = { ...next[idx], completed: true };
      }

      if (idx + 1 < next.length) {
        setCurrentChallengeIndex(idx + 1);
      } else {
        livenessCompleteRef.current = true;
        setStatus("scanning");
      }
      return next;
    });
  }, [currentChallengeIndex]);

  const handleLivenessFrame = useCallback(
    (detection: FaceDetectionResult, ear: number) => {
      const challenge = livenessStep[currentChallengeIndex];
      if (!challenge || challenge.completed) return;

      const positions = detection.landmarks.positions;
      const box = detection.detection.box;
      const faceCenterX = box.x + box.width / 2;

      if (challenge.type === "blink") {
        if (ear < 0.21) earWasLowRef.current = true;
        if (earWasLowRef.current && ear > 0.25) {
          setBlinkCount((c) => {
            const next = c + 1;
            if (next >= 2) markChallengeComplete();
            return next;
          });
          earWasLowRef.current = false;
        }
      }

      if (challenge.type === "turn-left") {
        const nose = positions[30];
        if (nose.x < faceCenterX - 15) {
          markChallengeComplete();
        }
      }

      if (challenge.type === "smile") {
        const mouthLeft = positions[48];
        const mouthRight = positions[54];
        const mouthWidth = Math.hypot(
          mouthRight.x - mouthLeft.x,
          mouthRight.y - mouthLeft.y
        );
        const ratio = mouthWidth / box.width;
        if (ratio > 0.42) {
          markChallengeComplete();
        }
      }
    },
    [currentChallengeIndex, livenessStep, markChallengeComplete]
  );

  const handleVerification = useCallback(
    async (detection: FaceDetectionResult) => {
      if (verifyingRef.current || statusRef.current === "matched") return;
      if (livenessRequired && !livenessCompleteRef.current) return;

      verifyingRef.current = true;
      const descriptor = Array.from(detection.descriptor);
      const result = matchFace(descriptor, students);

      if (result) {
        setDetectedName(result.student.name);
        setConfidence(result.confidence);
        setMatchedStudent(result.student);
        setStatus("matched");
        onVerifyComplete?.(true, result.student.id, result.confidence);
      } else {
        setDetectedName("Unknown");
        setConfidence(0);
        setStatus("failed");
        setError("Face not recognized. Please try again.");
        onVerifyComplete?.(false);
      }
      verifyingRef.current = false;
    },
    [livenessRequired, onVerifyComplete, students]
  );

  const startLiveness = useCallback(() => {
    if (livenessStartedRef.current) return;
    livenessStartedRef.current = true;
    setLivenessStep(buildLivenessSteps());
    setCurrentChallengeIndex(0);
    setBlinkCount(0);
    earWasLowRef.current = false;
    earHistoryRef.current = [];
    setStatus("liveness");
  }, []);

  // Start the camera + load models on mount. The parent gates rendering of
  // this component behind a user-gesture button (so autoplay restrictions on
  // mobile Safari / Chrome don't block getUserMedia).
  useEffect(() => {
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || status === "idle" || status === "loading-models")
      return;

    const scan = async () => {
      if (
        statusRef.current === "matched" ||
        statusRef.current === "enrolled" ||
        statusRef.current === "failed"
      ) {
        return;
      }

      try {
        const detection = await detectFace(video);

        if (detection) {
          let label = "Detecting...";
          let color = "#eab308";

          if (mode === "verify" && livenessCompleteRef.current) {
            label = "Verifying...";
            color = "#818cf8";
          } else if (statusRef.current === "liveness") {
            label = "Liveness...";
            color = "#a855f7";
          }

          drawFaceOverlay(canvas, video, detection, label, color);

          const ear = calculateCombinedEAR(detection.landmarks);
          earHistoryRef.current.push(ear);
          if (earHistoryRef.current.length > 10) earHistoryRef.current.shift();

          setFaceDetected(true);

          if (
            mode === "verify" &&
            livenessRequired &&
            !livenessCompleteRef.current &&
            statusRef.current === "scanning"
          ) {
            startLiveness();
          }

          if (mode === "verify" && statusRef.current === "liveness") {
            handleLivenessFrame(detection, ear);
          }

          if (
            mode === "verify" &&
            statusRef.current === "scanning" &&
            livenessCompleteRef.current
          ) {
            await handleVerification(detection);
          }
        } else {
          setFaceDetected(false);
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch {
        // Skip frame errors during scan loop
      }

      animFrameRef.current = requestAnimationFrame(scan);
    };

    animFrameRef.current = requestAnimationFrame(scan);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [
    mode,
    livenessRequired,
    detectedName,
    handleLivenessFrame,
    handleVerification,
    startLiveness,
    status,
  ]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stopCamera();
    };
  }, [stopCamera]);

  const handleCaptureEnroll = async () => {
    const video = videoRef.current;
    if (!video) return;

    setStatus("scanning");
    const descriptor = await getFaceDescriptor(video);
    if (!descriptor) {
      setError("No face detected. Please position your face in the frame.");
      setStatus("failed");
      return;
    }

    const photoBase64 = capturePhotoBase64(video);
    setStatus("enrolled");
    onEnrollComplete?.(descriptor, photoBase64);
  };

  const handleRetry = () => {
    setError("");
    setDetectedName("");
    setConfidence(0);
    setMatchedStudent(null);
    verifyingRef.current = false;
    livenessCompleteRef.current = false;
    livenessStartedRef.current = false;
    setBlinkCount(0);
    setLivenessStep([]);
    setCurrentChallengeIndex(0);
    setStatus("scanning");
  };

  const statusBadge = () => {
    switch (status) {
      case "liveness":
        return "LIVENESS CHECK";
      case "matched":
        return "MATCHED ✓";
      case "scanning":
        return "SCANNING...";
      case "loading-models":
        return "LOADING...";
      case "enrolled":
        return "ENROLLED ✓";
      case "failed":
        return "FAILED";
      default:
        return "READY";
    }
  };

  const badgeColor =
    status === "matched" || status === "enrolled"
      ? "bg-green-500/20 text-green-400"
      : status === "failed"
        ? "bg-red-500/20 text-red-400"
        : status === "liveness"
          ? "bg-purple-500/20 text-purple-300"
          : "bg-indigo-500/20 text-indigo-300";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div className="relative aspect-[4/3] w-full">
          <video
            ref={videoRef}
            className="h-full w-full"
            playsInline
            muted
            autoPlay
            controls={false}
            disablePictureInPicture
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ transform: "scaleX(-1)" }}
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg
              className="h-[85%] w-[85%] animate-scan-ring"
              viewBox="0 0 200 200"
              fill="none"
            >
              <circle
                cx="100"
                cy="100"
                r="92"
                stroke="url(#scanGrad)"
                strokeWidth="2"
                strokeDasharray="12 8"
                strokeLinecap="round"
                opacity="0.7"
              />
              <defs>
                <linearGradient id="scanGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div
            className={cn(
              "absolute left-3 top-3 rounded-lg px-3 py-1 text-xs font-bold tracking-wider",
              badgeColor
            )}
          >
            {statusBadge()}
          </div>

          {status === "failed" && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center backdrop-blur-sm">
              <div className="mb-3 text-5xl">⚠️</div>
              <p className="mb-2 font-display text-lg font-semibold text-red-300">
                Camera Error
              </p>
              <p className="mb-5 max-w-xs text-sm text-slate-300">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setDetectedName("");
                  setConfidence(0);
                  setMatchedStudent(null);
                  verifyingRef.current = false;
                  livenessCompleteRef.current = false;
                  livenessStartedRef.current = false;
                  setBlinkCount(0);
                  setLivenessStep([]);
                  setCurrentChallengeIndex(0);
                  setStatus("idle");
                  void startCamera();
                }}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 active:scale-95"
              >
                Try Again
              </button>
              <p className="mt-4 max-w-xs text-[11px] text-slate-500">
                Make sure you are using Chrome or Safari and camera permission
                is allowed.
              </p>
            </div>
          )}

          {(status === "matched" || status === "scanning") && confidence > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="mb-1 flex justify-between text-xs text-slate-300">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            {status === "loading-models" ? (
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            ) : status === "matched" || status === "enrolled" ? (
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            ) : status === "failed" ? (
              <XCircle className="h-8 w-8 text-red-400" />
            ) : (
              <ScanFace className="h-8 w-8 text-indigo-400" />
            )}
            <div>
              <p className="font-display font-semibold text-white">
                {mode === "enroll" ? "Face Enrollment" : "Face Verification"}
              </p>
              <p className="text-sm text-slate-400">
                {faceDetected
                  ? "Face detected in frame"
                  : "Position your face in the circle"}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        {status === "liveness" && livenessStep.length > 0 && (
          <LivenessOverlay
            challenges={livenessStep}
            currentIndex={currentChallengeIndex}
            onChallengeTimeout={() => {
              setError("Challenge timed out. Please try again.");
              handleRetry();
            }}
          />
        )}

        {mode === "enroll" && status !== "enrolled" && (
          <button
            type="button"
            onClick={handleCaptureEnroll}
            disabled={!faceDetected || status === "loading-models"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Camera className="h-5 w-5" />
            Capture Face
          </button>
        )}

        {mode === "verify" && status === "liveness" && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
            <p>
              Blinks completed:{" "}
              <span className="font-medium text-white">{blinkCount}</span> / 2
              {livenessStep[currentChallengeIndex]?.type === "blink"
                ? " (current challenge)"
                : ""}
            </p>
          </div>
        )}

        <AnimatePresence>
          {status === "matched" && matchedStudent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500">
                  {matchedStudent.photoURL ? (
                    <img
                      src={matchedStudent.photoURL}
                      alt={matchedStudent.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCheck className="h-7 w-7 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-white">
                    {matchedStudent.name}
                  </p>
                  <p className="font-mono text-sm text-slate-400">
                    {matchedStudent.enrollmentNo}
                  </p>
                  <p className="mt-1 text-sm font-medium text-green-400">
                    {confidence}% match confidence
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(status === "failed" || status === "matched") && mode === "verify" && (
          <button
            type="button"
            onClick={handleRetry}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 hover:bg-white/5"
          >
            Scan again
          </button>
        )}
      </div>

    </div>
  );
}
