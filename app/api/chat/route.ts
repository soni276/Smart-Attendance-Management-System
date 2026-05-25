import OpenAI from "openai";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import {
  KEYS,
  getAll,
  getAttendanceByDate,
  getFewShots,
  getSettings,
  saveFewShot,
} from "@/lib/storage-server";
import { getTodayString } from "@/lib/utils";
import type {
  ChatMessage,
  Course,
  Faculty,
  QRSession,
  Student,
} from "@/types";

interface ChatBody {
  message: string;
  conversationHistory: ChatMessage[];
  _store?: Record<string, unknown>;
}

function resolveApiKey(
  settings: ReturnType<typeof getSettings>
): string | null {
  return settings.openaiApiKey?.trim() || process.env.OPENAI_API_KEY || null;
}

function buildSystemPrompt(
  today: string,
  todayRecords: ReturnType<typeof getAttendanceByDate>,
  students: Student[],
  courses: Course[],
  faculty: Faculty[],
  settings: ReturnType<typeof getSettings>,
  fewShots: ReturnType<typeof getFewShots>,
  activeSessionsCount: number
): string {
  const activeStudents = students.filter((s) => s.isActive);
  const activeCount = activeStudents.length;

  const presentIds = new Set(
    todayRecords.filter((r) => r.status === "present").map((r) => r.studentId)
  );
  const lateIds = new Set(
    todayRecords.filter((r) => r.status === "late").map((r) => r.studentId)
  );
  const markedTodayIds = new Set([
    ...presentIds,
    ...lateIds,
    ...todayRecords
      .filter((r) => r.status === "half-day")
      .map((r) => r.studentId),
  ]);

  const absentToday = activeStudents.filter(
    (s) => !markedTodayIds.has(s.id)
  );

  const formatStudent = (s: Student) => {
    return `${s.name} (enrollment ${s.enrollmentNo} · ${s.department} · ${s.semester} Sem · Batch ${s.batch})`;
  };

  const lateStudentsList = todayRecords
    .filter((r) => r.status === "late")
    .map((r) => students.find((s) => s.id === r.studentId))
    .filter(Boolean)
    .map((s) => formatStudent(s as Student));

  const absentStudentsList = absentToday.map(formatStudent);

  const rosterPreview = activeStudents
    .slice(0, 30)
    .map(
      (s) =>
        `- ${s.name} | enrollment ${s.enrollmentNo} | ${s.department} | ${s.semester} Sem | Batch ${s.batch}`
    )
    .join("\n");

  const courseBlock = courses
    .map((c) => {
      const fac = faculty.find((f) => f.id === c.facultyId);
      return `- ${c.courseCode} ${c.courseName} (${c.department}, ${c.semester} Sem, Batch ${c.batch}, ${c.credits} credits) — ${c.studentIds.length} students — Faculty: ${fac?.name ?? "TBD"}`;
    })
    .join("\n");

  const facultyBlock = faculty
    .map(
      (f) =>
        `- ${f.name} | ${f.designation} | ${f.department} | ${f.employeeId}`
    )
    .join("\n");

  const fewShotBlock =
    fewShots.length > 0
      ? fewShots
          .slice(-5)
          .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
          .join("\n\n")
      : "No examples yet.";

  return `You are CampusBot, the intelligent AI assistant for Campus Attendance System at ${settings.institutionName} (${settings.academicYear} · ${settings.semesterName}).
You help faculty, students and admins with attendance queries. Use college / university terminology: courses not classes, faculty not teachers, enrollment number not roll number, batch not section, semester not standard. Refer to lectures, lab sessions, and papers — never homerooms.

TODAY'S SUMMARY (${today}):
- Total active students: ${activeCount}
- Marked present today: ${presentIds.size}
- Marked late today: ${lateIds.size}
- Absent today: ${absentToday.length}
- Active QR sessions: ${activeSessionsCount}
- Minimum attendance (university norm): ${settings.minAttendancePercent}%

COURSES:
${courseBlock || "(no courses configured)"}

FACULTY:
${facultyBlock || "(no faculty configured)"}

ABSENT STUDENTS TODAY (${absentToday.length}):
${absentStudentsList.length ? absentStudentsList.map((s) => `- ${s}`).join("\n") : "- none"}

LATE STUDENTS TODAY (${lateIds.size}):
${lateStudentsList.length ? lateStudentsList.map((s) => `- ${s}`).join("\n") : "- none"}

ROSTER PREVIEW (first 30 of ${activeCount}):
${rosterPreview || "(no students)"}

PAST Q&A EXAMPLES:
${fewShotBlock}

INSTRUCTIONS:
- Answer attendance queries precisely using the data above. Quote real names and enrollment numbers.
- When referring to a course, prefer the course code (e.g. CS301) plus its name.
- For "who is absent today?" list the names from ABSENT STUDENTS TODAY.
- For "show defaulters" or "below 75%", explain that detailed analytics are on the Analytics page; you can mention the university norm of ${settings.minAttendancePercent}% attendance is mandatory.
- Format lists as clean markdown tables when there are 3+ rows.
- Be concise but complete. Use **bold** for key numbers.
- If asked about students not in the roster, say so politely.
- Current time: ${new Date().toLocaleTimeString()}`;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<ChatBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const settings = getSettings();
    const apiKey = resolveApiKey(settings);
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "OpenAI API key not configured. Set OPENAI_API_KEY in your Vercel environment variables (Project → Settings → Environment Variables) or paste a key in Admin → Settings → AI.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const today = getTodayString();
    const todayRecords = getAttendanceByDate(today);
    const students = getAll<Student>(KEYS.STUDENTS);
    const courses = getAll<Course>(KEYS.COURSES);
    const faculty = getAll<Faculty>(KEYS.FACULTY);
    const fewShots = getFewShots();
    const activeSessionsCount = getAll<QRSession>(KEYS.QR_SESSIONS).filter(
      (s) => s.isActive
    ).length;

    const systemPrompt = buildSystemPrompt(
      today,
      todayRecords,
      students,
      courses,
      faculty,
      settings,
      fewShots,
      activeSessionsCount
    );

    const model = settings.openaiModel ?? "gpt-4o-mini";
    const openai = new OpenAI({ apiKey });

    const userMessage = body.message.trim();
    const rawHistory = (body.conversationHistory ?? []).filter(
      (m) => typeof m?.content === "string" && m.content.trim().length > 0
    );

    // Drop the most recent user message if it duplicates the current one
    // (the client sends conversationHistory with the new user msg already appended).
    const trimmedHistory =
      rawHistory.length > 0 &&
      rawHistory[rawHistory.length - 1].role === "user" &&
      rawHistory[rawHistory.length - 1].content.trim() === userMessage
        ? rawHistory.slice(0, -1)
        : rawHistory;

    const history = trimmedHistory.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const stream = openai.responses.stream({
      model,
      input: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
    });

    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              const delta = event.delta ?? "";
              if (delta) {
                fullText += delta;
                controller.enqueue(encoder.encode(delta));
              }
            }
          }
          await stream.finalResponse();
          if (fullText.trim().length > 20 && body.message.trim().length > 4) {
            saveFewShot(body.message.trim(), fullText.trim());
          }
          controller.close();
        } catch (err) {
          console.error("Chat stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const errAny = err as { message?: string; status?: number; code?: string };
    let message = errAny.message || "Chat failed";
    const status = typeof errAny.status === "number" ? errAny.status : 500;

    // Surface helpful messages for common OpenAI / config errors
    if (errAny.code === "invalid_api_key" || /invalid.*api.*key/i.test(message)) {
      message =
        "OpenAI API key is invalid or missing. Set OPENAI_API_KEY in your environment (or admin Settings → AI).";
    } else if (errAny.code === "insufficient_quota" || /quota/i.test(message)) {
      message =
        "OpenAI quota exceeded. Please add credits to your OpenAI account or use a different API key.";
    } else if (/rate.?limit/i.test(message)) {
      message = "Too many requests. Please wait a moment and try again.";
    } else if (status >= 500 && status < 600) {
      message = `AI service error: ${message}`;
    }

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
