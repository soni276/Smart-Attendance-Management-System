import type {
  Admin,
  AnomalyFlag,
  AppSettings,
  AttendanceRecord,
  ChatMessage,
  Course,
  Faculty,
  FewShotExample,
  QRSession,
  SessionUser,
  Student,
} from "@/types";
import { generateId } from "@/lib/utils";

export const KEYS = {
  STUDENTS: "sas_students",
  FACULTY: "sas_faculty",
  ADMINS: "sas_admins",
  COURSES: "sas_courses",
  ATTENDANCE: "sas_attendance",
  QR_SESSIONS: "sas_qr_sessions",
  CHAT_HISTORY: "sas_chat_history",
  FEW_SHOTS: "sas_few_shots",
  SETTINGS: "sas_settings",
  SESSION_USER: "sas_session_user",
  ANOMALIES: "sas_anomalies",
  INITIALIZED: "sas_initialized_v2",
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  institutionName: "Greenfield Institute of Technology",
  academicYear: "2025-2026",
  semesterName: "Even Semester 2025-26",
  minAttendancePercent: 75,
  qrExpirySeconds: 60,
  faceMatchThreshold: 0.5,
  geoFencingEnabled: false,
  geoLat: 0,
  geoLng: 0,
  geoRadiusMeters: 100,
  theme: "dark",
  latenessMinutes: 10,
  absentMinutes: 25,
  openaiModel: "gpt-4o-mini",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readRaw(key: string): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(key);
}

function writeRaw(key: string, value: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(key, value);
}

export function getAll<T>(key: string): T[] {
  try {
    const raw = readRaw(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getById<T extends { id: string }>(
  key: string,
  id: string
): T | null {
  return getAll<T>(key).find((item) => item.id === id) ?? null;
}

export function save<T extends { id: string }>(key: string, item: T): T {
  const items = getAll<T>(key);
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
  saveMany(key, items);
  return item;
}

export function saveMany<T>(key: string, items: T[]): void {
  writeRaw(key, JSON.stringify(items));
}

export function update<T extends { id: string }>(
  key: string,
  id: string,
  updates: Partial<T>
): T | null {
  const items = getAll<T>(key);
  const index = items.findIndex((i) => i.id === id);
  if (index < 0) return null;
  items[index] = { ...items[index], ...updates };
  saveMany(key, items);
  return items[index];
}

export function remove(key: string, id: string): void {
  const items = getAll<{ id: string }>(key).filter((i) => i.id !== id);
  saveMany(key, items);
}

export function clear(key: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(key);
}

export function getCurrentUser(): SessionUser | null {
  try {
    const raw = readRaw(KEYS.SESSION_USER);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: SessionUser): void {
  writeRaw(KEYS.SESSION_USER, JSON.stringify(user));
}

export function clearSession(): void {
  clear(KEYS.SESSION_USER);
}

export function getSettings(): AppSettings {
  try {
    const raw = readRaw(KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Partial<AppSettings>): void {
  const merged = { ...getSettings(), ...s };
  writeRaw(KEYS.SETTINGS, JSON.stringify(merged));
}

export function getAttendanceByDate(date: string): AttendanceRecord[] {
  return getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter((r) => r.date === date);
}

export function getAttendanceByStudent(studentId: string): AttendanceRecord[] {
  return getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter(
    (r) => r.studentId === studentId
  );
}

export function getAttendanceByCourse(
  courseId: string,
  date?: string
): AttendanceRecord[] {
  return getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter(
    (r) => r.courseId === courseId && (date === undefined || r.date === date)
  );
}

export function getActiveQRSession(): QRSession | null {
  return (
    getAll<QRSession>(KEYS.QR_SESSIONS).find((s) => s.isActive) ?? null
  );
}

export function getFewShots(): FewShotExample[] {
  const all = getAll<FewShotExample>(KEYS.FEW_SHOTS);
  return all.slice(-10);
}

export function saveFewShot(q: string, a: string): void {
  const shots = getAll<FewShotExample>(KEYS.FEW_SHOTS);
  shots.push({
    question: q,
    answer: a,
    timestamp: new Date().toISOString(),
  });
  saveMany(KEYS.FEW_SHOTS, shots.slice(-50));
}

const EXPORT_EXCLUDE: readonly string[] = [
  KEYS.SESSION_USER,
  KEYS.INITIALIZED,
];

export function exportAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {
    _meta: {
      exportedAt: new Date().toISOString(),
      version: 2,
    },
  };
  Object.values(KEYS).forEach((key) => {
    if (EXPORT_EXCLUDE.includes(key)) return;
    const raw = readRaw(key);
    if (raw) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  });
  return data;
}

export function importAllData(data: Record<string, unknown>): void {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid import data");
  }
  const validKeys = new Set<string>(Object.values(KEYS));
  Object.entries(data).forEach(([key, value]) => {
    if (key === "_meta") return;
    if (!validKeys.has(key)) return;
    if (key === KEYS.SESSION_USER) return;
    if (typeof value === "string") writeRaw(key, value);
    else writeRaw(key, JSON.stringify(value));
  });
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((key) => {
    if (key !== KEYS.SESSION_USER) clear(key);
  });
}

export function getChatHistory(): ChatMessage[] {
  return getAll<ChatMessage>(KEYS.CHAT_HISTORY).slice(-50);
}

export function saveChatHistory(messages: ChatMessage[]): void {
  saveMany(KEYS.CHAT_HISTORY, messages.slice(-50));
}

export function addAnomalyFlag(
  flag: Omit<AnomalyFlag, "id" | "detectedAt" | "resolved">
): void {
  const flags = getAll<AnomalyFlag>(KEYS.ANOMALIES);
  flags.push({
    ...flag,
    id: generateId(),
    detectedAt: new Date().toISOString(),
    resolved: false,
  });
  saveMany(KEYS.ANOMALIES, flags);
}

// Compatibility helpers — many places still call generic getters
export function getAllStudents(): Student[] {
  return getAll<Student>(KEYS.STUDENTS);
}
export function getAllFaculty(): Faculty[] {
  return getAll<Faculty>(KEYS.FACULTY);
}
export function getAllCourses(): Course[] {
  return getAll<Course>(KEYS.COURSES);
}
export function getAllAdmins(): Admin[] {
  return getAll<Admin>(KEYS.ADMINS);
}
