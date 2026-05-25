"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface HeatmapDay {
  date: string;
  percent: number;
  label: string;
}

interface CalendarHeatmapProps {
  days: HeatmapDay[];
  title?: string;
}

function heatColor(percent: number): string {
  if (percent < 60) return "bg-red-500/70";
  if (percent < 75) return "bg-yellow-500/70";
  if (percent < 90) return "bg-lime-500/60";
  return "bg-green-500/80";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarHeatmap({ days, title }: CalendarHeatmapProps) {
  const [tooltip, setTooltip] = useState<HeatmapDay | null>(null);

  const padded: (HeatmapDay | null)[] = [];
  if (days.length > 0) {
    const firstDow = new Date(days[0].date).getDay();
    for (let i = 0; i < firstDow; i++) padded.push(null);
    padded.push(...days);
    while (padded.length % 7 !== 0) padded.push(null);
  }

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      {title && (
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          {title}
        </h3>
      )}

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="relative space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) =>
              day ? (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (wi * 7 + di) * 0.01 }}
                  onMouseEnter={() => setTooltip(day)}
                  onMouseLeave={() => setTooltip(null)}
                  className={cn(
                    "aspect-square cursor-default rounded-md transition-transform hover:scale-110",
                    heatColor(day.percent)
                  )}
                  title={`${day.label}: ${day.percent}%`}
                />
              ) : (
                <div key={`empty-${wi}-${di}`} className="aspect-square" />
              )
            )}
          </div>
        ))}

        {tooltip && (
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-center text-xs shadow-xl backdrop-blur-xl">
            <p className="font-medium text-white">{tooltip.label}</p>
            <p className="text-indigo-300">{tooltip.percent}% attendance</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500">
        <span>Low</span>
        <div className="flex gap-1">
          <div className="h-3 w-6 rounded bg-red-500/70" />
          <div className="h-3 w-6 rounded bg-yellow-500/70" />
          <div className="h-3 w-6 rounded bg-lime-500/60" />
          <div className="h-3 w-6 rounded bg-green-500/80" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
