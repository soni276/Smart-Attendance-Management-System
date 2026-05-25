import { NextResponse } from "next/server";
import { createQRPayload, qrPayloadToString } from "@/lib/qr";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { KEYS, getById, save } from "@/lib/storage-server";
import type { QRSession } from "@/types";

interface RotateBody {
  sessionId: string;
  _store?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<RotateBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const session = getById<QRSession>(KEYS.QR_SESSIONS, body.sessionId);

    if (!session || !session.isActive) {
      return NextResponse.json(
        { error: "Session not found or inactive" },
        { status: 404 }
      );
    }

    const qrPayload = createQRPayload(session);
    const updated = save(KEYS.QR_SESSIONS, {
      ...session,
      currentNonce: qrPayload.nonce,
      currentSignature: qrPayload.signature,
      lastRotatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      qrPayload,
      qrString: qrPayloadToString(qrPayload),
      session: updated,
    });
  } catch (error) {
    console.error("[qr/rotate]", error);
    return NextResponse.json(
      { error: "Failed to rotate QR" },
      { status: 500 }
    );
  }
}
