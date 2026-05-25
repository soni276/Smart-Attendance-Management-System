"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  gradient: string;
  trend?: number;
  suffix?: string;
  delay?: number;
}

function AnimatedValue({
  value,
  suffix = "",
  inView,
}: {
  value: number;
  suffix?: string;
  inView: boolean;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 22 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) motionValue.set(value);
    else motionValue.set(0);
  }, [value, motionValue, inView]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend = 0,
  suffix = "",
  delay = 0,
}: StatsCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isPositive = trend >= 0;
  const trendLabel =
    trend === 0 ? "No change" : `${isPositive ? "+" : ""}${trend}% vs yesterday`;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 120, damping: 18 }}
      whileHover={{
        scale: 1.02,
        boxShadow: "0 0 32px rgba(99, 102, 241, 0.15)",
      }}
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6",
        "transition-colors hover:border-indigo-500/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
            gradient
          )}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
            isPositive
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {trendLabel}
        </div>
      </div>

      <p className="mt-6 font-display text-4xl font-bold tracking-tight text-white">
        <AnimatedValue value={value} suffix={suffix} inView={inView} />
      </p>
      <p className="mt-1 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </motion.div>
  );
}
