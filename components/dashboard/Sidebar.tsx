"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  School,
  ClipboardCheck,
  BarChart3,
  FileText,
  Settings,
  BookOpen,
  Calendar,
  ChevronLeft,
  LogOut,
  Shield,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { logout } from "@/lib/auth";
import { getCurrentUser } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Classes", href: "/admin/classes", icon: School },
  { label: "Mark Attendance", href: "/admin/mark-attendance", icon: ClipboardCheck },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Reports", href: "/admin/reports", icon: FileText },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const TEACHER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { label: "Mark Attendance", href: "/teacher/mark-attendance", icon: ClipboardCheck },
  { label: "My Classes", href: "/teacher/my-classes", icon: BookOpen },
  { label: "Reports", href: "/teacher/reports", icon: FileText },
];

const STUDENT_NAV: NavItem[] = [
  { label: "My Attendance", href: "/student", icon: ClipboardCheck },
  { label: "Schedule", href: "/student/schedule", icon: Calendar },
];

function getNavItems(role: SessionUser["role"]): NavItem[] {
  switch (role) {
    case "admin":
      return ADMIN_NAV;
    case "teacher":
      return TEACHER_NAV;
    case "student":
      return STUDENT_NAV;
    default:
      return [];
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  isMobile: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  isMobile,
  onToggle,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();
  const navItems = user ? getNavItems(user.role) : [];

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    router.push("/login");
  };

  if (!user) return null;

  const showLabels = isMobile ? true : !collapsed;
  const widthClass = isMobile
    ? "w-[260px]"
    : collapsed
      ? "w-[72px]"
      : "w-[260px]";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-xl transition-transform duration-300",
        widthClass,
        isMobile && !mobileOpen && "-translate-x-full",
        isMobile && mobileOpen && "translate-x-0 shadow-2xl"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <AnimatePresence>
            {showLabels && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-display text-lg font-bold whitespace-nowrap"
              >
                SAS
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn(
                "h-5 w-5 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/teacher" &&
              item.href !== "/student" &&
              pathname.startsWith(item.href));

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
            >
            <Link
              href={item.href}
              onClick={isMobile ? onMobileClose : undefined}
              title={!showLabels ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-indigo-500 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white"
                  : "border-l-2 border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {showLabels && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-white/[0.03] p-3",
            !showLabels && "justify-center"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-bold text-white">
            {getInitials(user.name)}
          </div>
          <AnimatePresence>
            {showLabels && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 flex-1 overflow-hidden"
              >
                <p className="truncate text-sm font-medium text-white">
                  {user.name}
                </p>
                <span className="inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs capitalize text-indigo-300">
                  {user.role}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-red-500/10 hover:text-red-400",
            !showLabels && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {showLabels && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
}
