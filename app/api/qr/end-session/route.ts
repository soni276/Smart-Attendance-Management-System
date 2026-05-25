import { NextResponse } from "next/server";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { KEYS, getAll, getById, save } from "@/lib/storage-server";
import { generateId } from "@/lib/utils";
import type { AttendanceRecord, Course, QRSession } from "@/types";

interface EndSessionBody {
  sessionId: string;
  facultyId: string;
  _store?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<EndSessionBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    if (!body.sessionId || !body.facultyId) {
      return NextResponse.json(
        { error: "Missing sessionId or facultyId" },
        { status: 400 }
      );
    }

    const session = getById<QRSession>(KEYS.QR_SESSIONS, body.sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.facultyId !== body.facultyId) {
      return NextResponse.json(
        { error: "Unauthorized: faculty mismatch" },
        { status: 403 }
      );
    }

    const course = getById<Course>(KEYS.COURSES, session.courseId);
    let absentMarked = 0;
    const markedAt = new Date().toISOString();
    const attendance = getAll<AttendanceRecord>(KEYS.ATTENDANCE);

    if (course) {
      const unmarked = course.studentIds.filter(
        (id) => !session.markedStudentIds.includes(id)
      );

      for (const studentId of unmarked) {
        const alreadyRecorded = attendance.some(
          (r) =>
            r.studentId === studentId &&
            r.courseId === session.courseId &&
            r.subjectId === session.subjectId &&
            r.date === session.date
        );

        if (alreadyRecorded) continue;

        save(KEYS.ATTENDANCE, {
          id: generateId(),
          studentId,
          courseId: session.courseId,
          subjectId: session.subjectId,
          date: session.date,
          status: "absent",
          markedBy: session.facultyId,
          facultyId: session.facultyId,
          markedAt,
          method: "manual",
        });
        absentMarked++;
      }
    }

    save(KEYS.QR_SESSIONS, {
      ...session,
      isActive: false,
    });

    return NextResponse.json({
      success: true,
      absentMarked,
    });
  } catch (error) {
    console.error("[qr/end-session]", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }
}
