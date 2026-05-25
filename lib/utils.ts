import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AttendanceRecord } from "@/types";

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function generateNonce(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWindowSlot(
  _classId: string,
  date: string,
  startTime: string,
  endTime: string
): string {
  return `${date}_${startTime}-${endTime}`;
}

export function calculateAttendancePercent(
  records: AttendanceRecord[],
  studentId: string
): number {
  const studentRecords = records.filter((r) => r.studentId === studentId);
  if (studentRecords.length === 0) return 0;

  const presentCount = studentRecords.filter(
    (r) =>
      r.status === "present" || r.status === "late" || r.status === "half-day"
  ).length;

  return Math.round((presentCount / studentRecords.length) * 100);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "present":
      return "text-green-500 bg-green-500/10";
    case "absent":
      return "text-red-500 bg-red-500/10";
    case "late":
      return "text-yellow-500 bg-yellow-500/10";
    case "half-day":
      return "text-orange-500 bg-orange-500/10";
    default:
      return "text-gray-500 bg-gray-500/10";
  }
}

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isWithinGeoFence(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusM: number
): boolean {
  const R = 6371000;
  const dLat = toRad(centerLat - lat);
  const dLng = toRad(centerLng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(centerLat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= radiusM;
}

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function singleEyeEAR(eye: { x: number; y: number }[]): number {
  const v1 = dist(eye[1], eye[5]);
  const v2 = dist(eye[2], eye[4]);
  const h = dist(eye[0], eye[3]);
  if (h === 0) return 0;
  return (v1 + v2) / (2 * h);
}

export function getEAR(landmarks: { x: number; y: number }[]): number {
  const leftEye = [36, 37, 38, 39, 40, 41].map((i) => landmarks[i]);
  const rightEye = [42, 43, 44, 45, 46, 47].map((i) => landmarks[i]);

  if (
    leftEye.some((p) => !p) ||
    rightEye.some((p) => !p) ||
    landmarks.length < 48
  ) {
    return 0;
  }

  return (singleEyeEAR(leftEye) + singleEyeEAR(rightEye)) / 2;
}

export function detectBlink(earHistory: number[]): boolean {
  if (earHistory.length < 3) return false;

  let dipped = false;
  let recovered = false;

  for (let i = 0; i < earHistory.length; i++) {
    if (earHistory[i] < 0.21) {
      dipped = true;
    }
    if (dipped && earHistory[i] >= 0.21) {
      recovered = true;
      break;
    }
  }

  return dipped && recovered;
}
