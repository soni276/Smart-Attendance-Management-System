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

/** RFC 4648 base64url encode (no padding, URL-safe). */
function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** RFC 4648 base64url decode. */
function base64urlDecode(input: string): string {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Resolve the canonical public origin for QR URLs.
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL  (set explicitly in env)
 *   2. VERCEL_URL           (automatic per-deployment on Vercel)
 *   3. request URL origin   (fallback when called from an API route)
 */
export function resolveAppUrl(request?: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }

  if (request) {
    try {
      const u = new URL(request.url);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }
  return "";
}

/**
 * Build a scannable QR URL like
 * `https://example.com/scan?data=<base64url(JSON.stringify(payload))>`.
 * Camera apps recognise this as a URL and open the scan page directly.
 */
export function qrPayloadToUrl(payload: QRPayload, appUrl: string): string {
  const base = (appUrl || "").replace(/\/+$/, "");
  const data = base64urlEncode(JSON.stringify(payload));
  return base ? `${base}/scan?data=${data}` : `/scan?data=${data}`;
}

/**
 * Accept any of these formats and return the parsed payload:
 *   - raw JSON                       (legacy QR contents)
 *   - https://host/scan?data=<b64u>  (new URL format)
 *   - just the base64url string      (data param value)
 */
export function stringToQRPayload(str: string): QRPayload | null {
  if (!str) return null;
  const trimmed = str.trim();

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as QRPayload;
    } catch {
      // fall through
    }
  }

  try {
    const url = new URL(trimmed);
    const data = url.searchParams.get("data");
    if (data) {
      const json = base64urlDecode(data);
      return JSON.parse(json) as QRPayload;
    }
  } catch {
    // not a URL — fall through
  }

  try {
    const json = base64urlDecode(trimmed);
    if (json.trim().startsWith("{")) {
      return JSON.parse(json) as QRPayload;
    }
  } catch {
    // fall through
  }

  return null;
}
