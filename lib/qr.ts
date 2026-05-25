import "server-only";

import CryptoJS from "crypto-js";
import { getAll, getSettings } from "@/lib/storage-server";
import { generateNonce } from "@/lib/utils";
import type { QRPayload, QRSession } from "@/types";

const QR_SECRET =
  process.env.NEXT_PUBLIC_QR_SECRET || "sas_secret_2026";

export function generateSignature(
  payload: Omit<QRPayload, "signature">
): string {
  const sorted = Object.keys(payload)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = payload[key as keyof Omit<QRPayload, "signature">];
        return acc;
      },
      {} as Record<string, unknown>
    );

  return CryptoJS.HmacSHA256(JSON.stringify(sorted), QR_SECRET).toString(
    CryptoJS.enc.Hex
  );
}

export function createQRPayload(session: QRSession): QRPayload {
  const settings = getSettings();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + settings.qrExpirySeconds * 1000;
  const nonce = generateNonce();

  const unsigned: Omit<QRPayload, "signature"> = {
    sessionId: session.id,
    courseId: session.courseId,
    subjectId: session.subjectId,
    facultyId: session.facultyId,
    windowSlot: session.windowSlot,
    issuedAt,
    expiresAt,
    nonce,
  };

  const signature = generateSignature(unsigned);
  return { ...unsigned, signature };
}

export function validateQRPayload(payload: QRPayload): {
  valid: boolean;
  error?: string;
  session?: QRSession;
} {
  if (payload.expiresAt <= Date.now()) {
    return {
      valid: false,
      error: "QR expired, please scan the updated code",
    };
  }

  const { signature, ...unsigned } = payload;
  const expected = generateSignature(unsigned);
  if (signature !== expected) {
    return { valid: false, error: "Invalid QR code" };
  }

  const session = getAll<QRSession>("sas_qr_sessions").find(
    (s) => s.id === payload.sessionId
  );

  if (!session) {
    return { valid: false, error: "Session not found or ended" };
  }

  if (!session.isActive) {
    return { valid: false, error: "Session has been closed by faculty" };
  }

  if (payload.nonce !== session.currentNonce) {
    return { valid: false, error: "QR outdated, please scan fresh code" };
  }

  return { valid: true, session };
}

export function qrPayloadToString(payload: QRPayload): string {
  return JSON.stringify(payload);
}

export function stringToQRPayload(str: string): QRPayload | null {
  try {
    return JSON.parse(str) as QRPayload;
  } catch {
    return null;
  }
}
