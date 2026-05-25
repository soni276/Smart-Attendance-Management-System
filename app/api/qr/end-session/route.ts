import { NextResponse } from "next/server";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { KEYS, getAll, getById, save } from "@/lib/storage-server";
import { generateId } from "@/lib/utils";
import type { AttendanceRecord, ClassRoom, QRSession } from "@/types";

interface EndSessionBody {
  sessionId: string;
  teacherId: string;
  _store?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<EndSessionBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    if (!body.sessionId || !body.teacherId) {
      return NextResponse.json(
        { error: "Missing sessionId or teacherId" },
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

    if (session.teacherId !== body.teacherId) {
      return NextResponse.json(
        { error: "Unauthorized: teacher mismatch" },
        { status: 403 }
      );
    }

    const classroom = getById<ClassRoom>(KEYS.CLASSES, session.classId);
    let absentMarked = 0;
    const markedAt = new Date().toISOString();
    const attendance = getAll<AttendanceRecord>(KEYS.ATTENDANCE);

    if (classroom) {
      const unmarked = classroom.studentIds.filter(
        (id) => !session.markedStudentIds.includes(id)
      );

      for (const studentId of unmarked) {
        const alreadyRecorded = attendance.some(
          (r) =>
            r.studentId === studentId &&
            r.classId === session.classId &&
            r.subjectId === session.subjectId &&
            r.date === session.date
        );

        if (alreadyRecorded) continue;

        save(KEYS.ATTENDANCE, {
          id: generateId(),
          studentId,
          classId: session.classId,
          subjectId: session.subjectId,
          date: session.date,
          status: "absent",
          markedBy: session.teacherId,
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
