"use client";

import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

export const CHART_THEME = {
  grid: "rgba(255,255,255,0.06)",
  axis: "#64748b",
  tick: "#94a3b8",
  present: "#6366f1",
  late: "#f59e0b",
  absent: "#ef4444",
  halfDay: "#f97316",
  presentGreen: "#22c55e",
} as const;

export const CHART_ANIMATION = {
  animationDuration: 1000,
  animationEasing: "ease-out" as const,
};

interface AttendanceChartProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
}

interface GlassTooltipPayload {
  color?: string;
  name?: string;
  value?: number;
  dataKey?: string;
}

export function GlassTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string> & {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur-xl">
      {label && (
        <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry: GlassTooltipPayload, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-300">{entry.name}:</span>
            <span className="font-semibold text-white">
              {typeof entry.value === "number"
                ? entry.value % 1 === 0
                  ? entry.value
                  : entry.value.toFixed(1)
                : entry.value}
              {entry.name?.includes("%") || entry.dataKey === "percent" ? "%" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendanceChart({
  children,
  title,
  subtitle,
  height = 280,
  className,
}: AttendanceChartProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="font-display text-lg font-semibold text-white">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export { Tooltip };

export type { GlassTooltipPayload };
