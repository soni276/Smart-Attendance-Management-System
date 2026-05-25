import { NextResponse } from "next/server";
import {
  createQRPayload,
  qrPayloadToString,
} from "@/lib/qr";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { KEYS, getAll, getSettings, save } from "@/lib/storage-server";
import { generateId, getTodayString, getWindowSlot } from "@/lib/utils";
import type { QRSession } from "@/types";

interface GenerateBody {
  classId: string;
  subjectId: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  className: string;
  startTime: string;
  endTime: string;
  lateAfterMinutes?: number;
  absentAfterMinutes?: number;
  _store?: Record<string, unknown>;
}

function toSlotTime(time: string): string {
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  const d = new Date(time);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function toISODateTime(date: string, time: string): string {
  const slot = toSlotTime(time);
  return new Date(`${date}T${slot}:00`).toISOString();
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<GenerateBody>(request as import("next/server").NextRequest);
    prepareStore(body);

    const required = [
      "classId",
      "subjectId",
      "subject",
      "teacherId",
      "teacherName",
      "className",
      "startTime",
      "endTime",
    ] as const;

    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const settings = getSettings();
    const date = getTodayString();
    const slotStart = toSlotTime(body.startTime);
    const slotEnd = toSlotTime(body.endTime);
    const windowSlot = getWindowSlot(
      body.classId,
      date,
      slotStart,
      slotEnd
    );

    const existing = getAll<QRSession>(KEYS.QR_SESSIONS).find(
      (s) =>
        s.isActive &&
        s.classId === body.classId &&
        s.windowSlot === windowSlot
    );

    if (existing) {
      const qrPayload = createQRPayload(existing);
      const updated = save(KEYS.QR_SESSIONS, {
        ...existing,
        currentNonce: qrPayload.nonce,
        currentSignature: qrPayload.signature,
        lastRotatedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        session: updated,
        qrPayload,
        qrString: qrPayloadToString(qrPayload),
      });
    }

    const now = new Date().toISOString();
    let session: QRSession = {
      id: generateId(),
      classId: body.classId,
      subjectId: body.subjectId,
      subject: body.subject,
      teacherId: body.teacherId,
      teacherName: body.teacherName,
      className: body.className,
      date,
      windowSlot,
      startTime: toISODateTime(date, body.startTime),
      endTime: toISODateTime(date, body.endTime),
      lateAfterMinutes: body.lateAfterMinutes ?? settings.latenessMinutes,
      absentAfterMinutes: body.absentAfterMinutes ?? settings.absentMinutes,
      isActive: true,
      markedStudentIds: [],
      currentNonce: "",
      currentSignature: "",
      lastRotatedAt: now,
      createdAt: now,
    };

    const qrPayload = createQRPayload(session);
    session = {
      ...session,
      currentNonce: qrPayload.nonce,
      currentSignature: qrPayload.signature,
    };

    const saved = save(KEYS.QR_SESSIONS, session);

    return NextResponse.json({
      session: saved,
      qrPayload,
      qrString: qrPayloadToString(qrPayload),
    });
  } catch (error) {
    console.error("[qr/generate]", error);
    return NextResponse.json(
      { error: "Failed to generate QR session" },
      { status: 500 }
    );
  }
}
