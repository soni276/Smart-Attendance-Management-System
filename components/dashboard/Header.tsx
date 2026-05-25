"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Menu,
  QrCode,
  Sparkles,
} from "lucide-react";
import {
  KEYS,
  getAll,
  getCurrentUser,
  getSettings,
} from "@/lib/storage";
import {
  calculateAttendancePercent,
  formatDate,
  formatTime,
} from "@/lib/utils";
import type {
  AnomalyFlag,
  AttendanceRecord,
  ClassRoom,
  QRSession,
  SessionUser,
  Student,
} from "@/types";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/students": "Students",
  "/admin/classes": "Classes",
  "/admin/mark-attendance": "Mark Attendance",
  "/admin/analytics": "Analytics",
  "/admin/reports": "Reports",
  "/admin/settings": "Settings",
  "/teacher": "Dashboard",
  "/teacher/mark-attendance": "Mark Attendance",
  "/teacher/my-classes": "My Classes",
  "/teacher/reports": "Reports",
  "/student": "My Attendance",
  "/student/schedule": "Schedule",
};

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => k !== "/admin" && k !== "/teacher" && k !== "/student")
    .find((k) => pathname.startsWith(k));
  return match ? PAGE_TITLES[match] : "Dashboard";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface NotificationItem {
  id: string;
  type: "defaulter" | "session" | "anomaly" | "info";
  title: string;
  description: string;
  href?: string;
  timestamp?: string;
}

function buildNotifications(user: SessionUser): NotificationItem[] {
  const items: NotificationItem[] = [];
  const settings = getSettings();
  const students = getAll<Student>(KEYS.STUDENTS);
  const records = getAll<AttendanceRecord>(KEYS.ATTENDANCE);
  const classes = getAll<ClassRoom>(KEYS.CLASSES);
  const sessions = getAll<QRSession>(KEYS.QR_SESSIONS);
  const anomalies = getAll<AnomalyFlag>(KEYS.ANOMALIES).filter(
    (a) => !a.resolved
  );

  let scopedStudents = students.filter((s) => s.isActive);
  let scopedSessions = sessions.filter((s) => s.isActive);

  if (user.role === "teacher") {
    const myClasses = classes.filter((c) => c.teacherId === user.userId);
    const ids = new Set(myClasses.map((c) => c.id));
    scopedStudents = scopedStudents.filter((s) => ids.has(s.classId));
    scopedSessions = scopedSessions.filter((s) => ids.has(s.classId));
  } else if (user.role === "student") {
    scopedStudents = scopedStudents.filter((s) => s.id === user.userId);
    scopedSessions = scopedSessions.filter(
      (s) => students.find((st) => st.id === user.userId)?.classId === s.classId
    );
  }

  for (const s of scopedStudents) {
    const pct = calculateAttendancePercent(records, s.id);
    if (pct < settings.minAttendancePercent) {
      items.push({
        id: `def-${s.id}`,
        type: "defaulter",
        title: `${s.name} below threshold`,
        description: `${pct}% attendance · target ${settings.minAttendancePercent}%`,
        href:
          user.role === "admin"
            ? "/admin/analytics"
            : user.role === "teacher"
              ? "/teacher/reports"
              : "/student",
      });
    }
  }

  for (const s of scopedSessions) {
    items.push({
      id: `qr-${s.id}`,
      type: "session",
      title: `Live: ${s.subject}`,
      description: `${s.className} · ${s.markedStudentIds.length} marked`,
      href:
        user.role === "teacher"
          ? "/teacher/mark-attendance"
          : "/admin/mark-attendance",
      timestamp: s.startTime,
    });
  }

  if (user.role === "admin") {
    for (const a of anomalies) {
      items.push({
        id: `an-${a.id}`,
        type: "anomaly",
        title: `${a.type.replace("-", " ")} flagged`,
        description: a.description,
        href: "/admin/analytics",
        timestamp: a.detectedAt,
      });
    }
  }

  return items.slice(0, 12);
}

const TYPE_ICON: Record<NotificationItem["type"], typeof Bell> = {
  defaulter: AlertTriangle,
  session: QrCode,
  anomaly: Sparkles,
  info: Bell,
};

const TYPE_COLOR: Record<NotificationItem["type"], string> = {
  defaulter: "text-amber-300 bg-amber-500/10",
  session: "text-indigo-300 bg-indigo-500/10",
  anomaly: "text-rose-300 bg-rose-500/10",
  info: "text-slate-300 bg-white/5",
};

function NotificationsButton({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = useMemo(() => {
    void tick;
    return buildNotifications(user);
  }, [user, tick]);

  const unread = items.filter((i) => !readIds.has(i.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(items.map((i) => i.id)));
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e16]/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="text-sm font-semibold text-white">Notifications</p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-indigo-300 hover:text-indigo-200"
                >
                  Mark all read
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> All caught up
                </span>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto py-1">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No notifications right now.
                </div>
              ) : (
                items.map((item) => {
                  const Icon = TYPE_ICON[item.type];
                  const isRead = readIds.has(item.id);
                  const inner = (
                    <div
                      className={`flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${
                        !isRead ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_COLOR[item.type]}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            !isRead ? "font-semibold text-white" : "text-slate-300"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>
                      {!isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                      )}
                    </div>
                  );
                  return item.href ? (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        setReadIds((s) => new Set(s).add(item.id));
                        setOpen(false);
                      }}
                      className="block"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setReadIds((s) => new Set(s).add(item.id))
                      }
                      className="w-full text-left"
                    >
                      {inner}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface HeaderProps {
  sidebarCollapsed: boolean;
  isMobile?: boolean;
  onMenuClick?: () => void;
  sidebarWidth?: number;
}

export function Header({
  sidebarCollapsed,
  isMobile = false,
  onMenuClick,
  sidebarWidth,
}: HeaderProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const title = resolveTitle(pathname);
  const left =
    sidebarWidth !== undefined
      ? sidebarWidth
      : isMobile
        ? 0
        : sidebarCollapsed
          ? 72
          : 260;

  return (
    <header
      className="fixed top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 backdrop-blur-xl sm:px-6 print:hidden"
      style={{ left, right: 0 }}
    >
      <div className="flex items-center gap-3">
        {isMobile && onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="font-display text-lg font-semibold text-white sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4 sm:gap-5">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-white">{formatDate(now)}</p>
          <p className="text-xs text-slate-400">{formatTime(now)}</p>
        </div>

        {user && <NotificationsButton user={user} />}

        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs capitalize text-slate-400">{user.role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {getInitials(user.name)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
