"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, Smile } from "lucide-react";
import type { LivenessChallenge } from "@/types";
import { cn } from "@/lib/utils";

const CHALLENGE_SECONDS = 5;

interface LivenessOverlayProps {
  challenges: LivenessChallenge[];
  currentIndex: number;
  onChallengeTimeout?: () => void;
  className?: string;
}

function ChallengeIcon({ type }: { type: LivenessChallenge["type"] }) {
  switch (type) {
    case "blink":
      return <Eye className="h-16 w-16" />;
    case "turn-left":
    case "turn-right":
      return <ArrowLeft className="h-16 w-16" />;
    case "smile":
      return <Smile className="h-16 w-16" />;
    default:
      return <Eye className="h-16 w-16" />;
  }
}

export function LivenessOverlay({
  challenges,
  currentIndex,
  onChallengeTimeout,
  className,
}: LivenessOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(CHALLENGE_SECONDS);
  const current = challenges[currentIndex];

  useEffect(() => {
    if (!current || current.completed) return;

    setSecondsLeft(CHALLENGE_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onChallengeTimeout?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, current?.completed, current, onChallengeTimeout]);

  if (!current) return null;

  const progress = (CHALLENGE_SECONDS - secondsLeft) / CHALLENGE_SECONDS;
  const circumference = 2 * Math.PI * 44;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl",
        className
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="flex flex-col items-center text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-300"
          >
            <ChallengeIcon type={current.type} />
          </motion.div>

          <p className="font-display text-lg font-semibold text-white">
            Liveness check
          </p>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            {current.instruction}
          </p>

          <div className="relative mt-6 h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="url(#livenessGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient
                  id="livenessGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
              {secondsLeft}
            </span>
          </div>

          <div className="mt-6 flex gap-2">
            {challenges.map((c, i) => (
              <div
                key={`${c.type}-${i}`}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  c.completed
                    ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                    : i === currentIndex
                      ? "bg-indigo-400 scale-125"
                      : "bg-white/20"
                )}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
