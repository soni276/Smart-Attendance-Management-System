import "server-only";

import fs from "fs";
import path from "path";
import type {
  AnomalyFlag,
  AppSettings,
  AttendanceRecord,
  FewShotExample,
  QRSession,
} from "@/types";
import { generateId } from "@/lib/utils";

import { KEYS } from "@/lib/storage";

export { KEYS };

const SERVER_STORE_PATH = path.join(process.cwd(), "data", "sas-store.json");

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

// On serverless / read-only filesystems (Vercel, Netlify, etc.) we cannot write
// to disk. Fall back to a module-level in-memory cache that is populated each
// request via `syncFromClientStore` from the client's localStorage snapshot.
let memoryStore: Record<string, string> = {};
let useMemoryStore = false;

function readServerFile(): Record<string, string> {
  if (useMemoryStore) return { ...memoryStore };
  try {
    if (!fs.existsSync(SERVER_STORE_PATH)) return { ...memoryStore };
    const fileData = JSON.parse(
      fs.readFileSync(SERVER_STORE_PATH, "utf-8")
    ) as Record<string, string>;
    return { ...memoryStore, ...fileData };
  } catch {
    return { ...memoryStore };
  }
}

function writeServerFile(store: Record<string, string>): void {
  if (useMemoryStore) {
    memoryStore = { ...store };
    return;
  }
  try {
    fs.mkdirSync(path.dirname(SERVER_STORE_PATH), { recursive: true });
    fs.writeFileSync(
      SERVER_STORE_PATH,
      JSON.stringify(store, null, 2),
      "utf-8"
    );
  } catch (err) {
    // Read-only filesystem (e.g. Vercel /var/task). Switch to in-memory store.
    if (typeof console !== "undefined") {
      console.warn(
        "[storage-server] disk write failed, falling back to in-memory store:",
        err instanceof Error ? err.message : err
      );
    }
    useMemoryStore = true;
    memoryStore = { ...store };
  }
}

function readRaw(key: string): string | null {
  const store = readServerFile();
  return store[key] ?? null;
}

function writeRaw(key: string, value: string): void {
  const store = readServerFile();
  store[key] = value;
  writeServerFile(store);
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

export function saveSettings(s: Partial<AppSettings>): void {
  const merged = { ...getSettings(), ...s };
  writeRaw(KEYS.SETTINGS, JSON.stringify(merged));
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

export function getActiveQRSession(): QRSession | null {
  return (
    getAll<QRSession>(KEYS.QR_SESSIONS).find((s) => s.isActive) ?? null
  );
}

export function getAttendanceByDate(date: string): AttendanceRecord[] {
  return getAll<AttendanceRecord>(KEYS.ATTENDANCE).filter(
    (r) => r.date === date
  );
}

export function getFewShots(): FewShotExample[] {
  return getAll<FewShotExample>(KEYS.FEW_SHOTS).slice(-10);
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

/** Merge client localStorage snapshot sent with API requests */
export function syncFromClientStore(
  store: Record<string, unknown> | undefined
): void {
  if (!store || typeof store !== "object") return;

  const fileStore = readServerFile();
  for (const [key, value] of Object.entries(store)) {
    if (typeof value === "string") {
      fileStore[key] = value;
    } else if (value !== undefined) {
      fileStore[key] = JSON.stringify(value);
    }
  }
  writeServerFile(fileStore);
}
