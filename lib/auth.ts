import {
  clearSession,
  getAll,
  getCurrentUser,
  KEYS,
  setCurrentUser,
} from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type { Admin, SessionUser, Student, Teacher } from "@/types";

const SESSION_COOKIE = "sas_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function setSessionCookie(user: SessionUser): void {
  const value = encodeURIComponent(JSON.stringify(user));
  document.cookie = `${SESSION_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function login(
  email: string,
  password: string,
  role: SessionUser["role"]
): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  let session: SessionUser | null = null;

  if (role === "admin") {
    const admin = getAll<Admin>(KEYS.ADMINS).find(
      (a) => a.email.toLowerCase() === normalizedEmail
    );
    if (admin && admin.password === normalizedPassword) {
      session = {
        userId: admin.id,
        role: "admin",
        name: admin.name,
        email: admin.email,
        token: generateId(),
      };
    }
  } else if (role === "teacher") {
    const teacher = getAll<Teacher>(KEYS.TEACHERS).find(
      (t) => t.email.toLowerCase() === normalizedEmail
    );
    if (teacher && teacher.password === normalizedPassword) {
      session = {
        userId: teacher.id,
        role: "teacher",
        name: teacher.name,
        email: teacher.email,
        token: generateId(),
      };
    }
  } else if (role === "student") {
    const student = getAll<Student>(KEYS.STUDENTS).find(
      (s) => s.email.toLowerCase() === normalizedEmail
    );
    if (student && student.rollNo === normalizedPassword) {
      session = {
        userId: student.id,
        role: "student",
        name: student.name,
        email: student.email,
        token: generateId(),
      };
    }
  }

  if (!session) return null;

  setCurrentUser(session);
  setSessionCookie(session);
  return session;
}

export function logout(): void {
  clearSession();
  clearSessionCookie();
}

export function getSession(): SessionUser | null {
  return getCurrentUser();
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
