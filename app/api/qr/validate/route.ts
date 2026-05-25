import { NextResponse } from "next/server";
import { stringToQRPayload, validateQRPayload } from "@/lib/qr";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { KEYS, getById, getSettings } from "@/lib/storage-server";
import { isWithinGeoFence } from "@/lib/utils";
import type { Course } from "@/types";

interface ValidateBody {
  qrString: string;
  studentId: string;
  geoLat?: number;
  geoLng?: number;
  _store?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<ValidateBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    if (!body.qrString || !body.studentId) {
      return NextResponse.json(
        { valid: false, error: "Missing qrString or studentId" },
        { status: 400 }
      );
    }

    const payload = stringToQRPayload(body.qrString);
    if (!payload) {
      return NextResponse.json({
        valid: false,
        error: "Invalid QR code format",
      });
    }

    const result = validateQRPayload(payload);
    if (!result.valid || !result.session) {
      return NextResponse.json({
        valid: false,
        error: result.error ?? "Validation failed",
      });
    }

    const { session } = result;

    const course = getById<Course>(KEYS.COURSES, session.courseId);
    if (!course || !course.studentIds.includes(body.studentId)) {
      return NextResponse.json({
        valid: false,
        error: "You are not enrolled in this course",
      });
    }

    if (session.markedStudentIds.includes(body.studentId)) {
      return NextResponse.json({
        valid: false,
        error: "Attendance already marked for this session",
      });
    }

    const settings = getSettings();
    if (settings.geoFencingEnabled) {
      if (body.geoLat === undefined || body.geoLng === undefined) {
        return NextResponse.json({
          valid: false,
          error: "Location data required for attendance",
        });
      }

      const inFence = isWithinGeoFence(
        body.geoLat,
        body.geoLng,
        settings.geoLat,
        settings.geoLng,
        settings.geoRadiusMeters
      );

      if (!inFence) {
        return NextResponse.json({
          valid: false,
          error: "You are not within the campus location",
        });
      }
    }

    return NextResponse.json({
      valid: true,
      sessionId: session.id,
      session,
      message: "QR verified! Proceed to face scan",
    });
  } catch (error) {
    console.error("[qr/validate]", error);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}
