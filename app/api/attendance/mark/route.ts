import { NextResponse } from "next/server";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import {
  KEYS,
  addAnomalyFlag,
  getAll,
  getById,
  save,
} from "@/lib/storage-server";
import { generateId } from "@/lib/utils";
import type {
  AttendanceRecord,
  QRSession,
  Student,
} from "@/types";

interface MarkBody {
  sessionId: string;
  studentId: string;
  livenessVerified: boolean;
  _store?: Record<string, unknown>;
}

function resolveStatus(session: QRSession): AttendanceRecord["status"] {
  const minutesSinceStart =
    (Date.now() - new Date(session.startTime).getTime()) / 60000;

  if (minutesSinceStart <= session.lateAfterMinutes) return "present";
  if (minutesSinceStart <= session.absentAfterMinutes) return "late";
  return "absent";
}

function hasThreeConsecutiveAbsences(
  studentId: string,
  courseId: string,
  subjectId: string
): boolean {
  const records = getAll<AttendanceRecord>(KEYS.ATTENDANCE)
    .filter(
      (r) =>
        r.studentId === studentId &&
        r.courseId === courseId &&
        r.subjectId === subjectId
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const recent = records.slice(0, 3);
  return recent.length >= 3 && recent.every((r) => r.status === "absent");
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<MarkBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    if (!body.sessionId || !body.studentId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId or studentId" },
        { status: 400 }
      );
    }

    if (!body.livenessVerified) {
      return NextResponse.json({
        success: false,
        error: "Liveness check failed",
      });
    }

    const session = getById<QRSession>(KEYS.QR_SESSIONS, body.sessionId);

    if (!session || !session.isActive) {
      return NextResponse.json(
        { success: false, error: "Session not found or inactive" },
        { status: 404 }
      );
    }

    if (session.markedStudentIds.includes(body.studentId)) {
      return NextResponse.json({
        success: false,
        error: "Attendance already marked for this session",
      });
    }

    const student = getById<Student>(KEYS.STUDENTS, body.studentId);
    const status = resolveStatus(session);
    const markedAt = new Date().toISOString();
    const minutesSinceStart =
      (Date.now() - new Date(session.startTime).getTime()) / 60000;

    const record: AttendanceRecord = {
      id: generateId(),
      studentId: body.studentId,
      courseId: session.courseId,
      subjectId: session.subjectId,
      date: session.date,
      status,
      markedBy: session.facultyId,
      facultyId: session.facultyId,
      markedAt,
      method: "face-qr",
      ...(status === "late"
        ? {
            latenessMinutes: Math.max(
              0,
              Math.round(minutesSinceStart - session.lateAfterMinutes)
            ),
          }
        : {}),
    };

    save(KEYS.ATTENDANCE, record);

    const updatedSession = save(KEYS.QR_SESSIONS, {
      ...session,
      markedStudentIds: [...session.markedStudentIds, body.studentId],
    });

    if (
      hasThreeConsecutiveAbsences(
        body.studentId,
        session.courseId,
        session.subjectId
      )
    ) {
      addAnomalyFlag({
        type: "repeated-failure",
        studentIds: [body.studentId],
        description: `Student was absent in 3 consecutive ${session.subject} sessions`,
        severity: "medium",
      });
    }

    return NextResponse.json({
      success: true,
      status,
      markedAt,
      studentName: student?.name ?? "Unknown",
      session: updatedSession,
      note:
        status === "absent"
          ? "Marked absent due to late arrival beyond threshold"
          : undefined,
    });
  } catch (error) {
    console.error("[attendance/mark]", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark attendance" },
      { status: 500 }
    );
  }
}
