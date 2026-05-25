import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  generateAIInsights,
  getAttendanceSummary,
  getCoursewiseSummary,
  getDefaulters,
  getSubjectwiseSummary,
  getWeeklyTrend,
} from "@/lib/analytics";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { KEYS, getAll, getSettings, saveFewShot } from "@/lib/storage-server";
import type { AttendanceRecord, Course, Student } from "@/types";

interface InsightsBody {
  dateRange: { days: number } | { from: string; to: string };
  courseId?: string;
  _store?: Record<string, unknown>;
}

function filterRecords(
  records: AttendanceRecord[],
  dateRange: InsightsBody["dateRange"],
  courseId?: string
): AttendanceRecord[] {
  let filtered = records;

  if ("days" in dateRange) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (dateRange.days - 1));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    filtered = filtered.filter((r) => r.date >= from && r.date <= to);
  } else {
    filtered = filtered.filter(
      (r) => r.date >= dateRange.from && r.date <= dateRange.to
    );
  }

  if (courseId) {
    filtered = filtered.filter((r) => r.courseId === courseId);
  }

  return filtered;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<InsightsBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    const settings = getSettings();
    const apiKey =
      settings.openaiApiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const students = getAll<Student>(KEYS.STUDENTS);
    const courses = getAll<Course>(KEYS.COURSES);
    const allRecords = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
    const records = filterRecords(allRecords, body.dateRange, body.courseId);

    const summary = getAttendanceSummary(records, students);
    const days = "days" in body.dateRange ? body.dateRange.days : 30;
    const trends = getWeeklyTrend(records, Math.min(days, 30));
    const defaulters = getDefaulters(
      records,
      students,
      settings.minAttendancePercent
    );
    const courseSummaries = getCoursewiseSummary(records, courses, students);
    const subjectSummaries = getSubjectwiseSummary(records, courses);

    const prompt = generateAIInsights(
      summary,
      trends,
      defaulters,
      courseSummaries,
      subjectSummaries
    );

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: settings.openaiModel ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert university attendance analyst. Use college terminology: courses (not classes), faculty (not teachers), enrollment number (not roll number), batch (not section), semester. Provide clear, data-driven insights in markdown. Each insight must use ### heading, **Severity:** line, and a description with specific numbers.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const insights =
      completion.choices[0]?.message?.content?.trim() ??
      "No insights generated.";

    const rangeLabel =
      "days" in body.dateRange
        ? `Last ${body.dateRange.days} days`
        : `${body.dateRange.from} to ${body.dateRange.to}`;

    saveFewShot(
      `Analytics insights for ${rangeLabel}${body.courseId ? ` (course ${body.courseId})` : ""}`,
      insights
    );

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("Analytics insights error:", err);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
