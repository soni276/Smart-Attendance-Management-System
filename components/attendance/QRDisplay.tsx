"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

interface QRDisplayProps {
  qrString: string;
  expirySeconds?: number;
  sessionId: string;
  signature?: string;
  className?: string;
  courseLabel?: string;
  subjectLabel?: string;
  dateLabel?: string;
  timeLabel?: string;
  onExpire?: () => void;
}

export function QRDisplay({
  qrString,
  expirySeconds = 60,
  sessionId,
  signature,
  className,
  courseLabel,
  subjectLabel,
  dateLabel,
  timeLabel,
  onExpire,
}: QRDisplayProps) {
  const [secondsLeft, setSecondsLeft] = useState(expirySeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / expirySeconds;
  const strokeDashoffset = circumference * (1 - progress);

  useEffect(() => {
    if (!qrString) return;

    setSecondsLeft(expirySeconds);
    const expiryMs = expirySeconds * 1000;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 1000;
      setSecondsLeft(Math.max(0, Math.ceil((expiryMs - elapsed) / 1000)));

      if (elapsed >= expiryMs) {
        elapsed = 0;
        setSecondsLeft(expirySeconds);
        onExpireRef.current?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [qrString, expirySeconds]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6",
        className
      )}
    >
      <div className="relative mx-auto flex w-fit flex-col items-center">
        <div className="relative flex items-center justify-center">
          <svg
            className="absolute h-[220px] w-[220px] -rotate-90"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="url(#qrCountdownGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
            <defs>
              <linearGradient id="qrCountdownGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative z-10 rounded-2xl bg-white p-4 shadow-xl">
            <AnimatePresence mode="wait">
              {qrString ? (
                <motion.div
                  key={qrString}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <QRCodeSVG value={qrString} size={200} level="M" includeMargin />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-[200px] w-[200px] items-center justify-center text-sm text-slate-400"
                >
                  Generating QR…
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        <p className="mt-3 text-lg font-bold text-white">{secondsLeft}s</p>

        <p className="mt-4 text-center text-xs text-slate-500">
          QR refreshes every {expirySeconds} seconds
        </p>

        {process.env.NODE_ENV === "development" && qrString && (
          <p className="mt-3 max-w-[240px] break-all text-center font-mono text-[10px] text-slate-600">
            {qrString.length > 80 ? `${qrString.slice(0, 80)}…` : qrString}
          </p>
        )}
      </div>

      {(courseLabel || subjectLabel || dateLabel || timeLabel) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {courseLabel && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {courseLabel}
            </span>
          )}
          {subjectLabel && (
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
              {subjectLabel}
            </span>
          )}
          {dateLabel && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {dateLabel}
            </span>
          )}
          {timeLabel && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {timeLabel}
            </span>
          )}
        </div>
      )}

      {signature && (
        <p className="mt-3 text-center font-mono text-xs text-slate-500">
          Signature: {signature.slice(0, 8)}…
        </p>
      )}

      <p className="mt-2 text-center text-[10px] text-slate-600">
        Session {sessionId.slice(0, 8)}…
      </p>
    </div>
  );
}
