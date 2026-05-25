"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  Shield,
  GraduationCap,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { login } from "@/lib/auth";
import type { SessionUser } from "@/types";
import { cn } from "@/lib/utils";

type Role = SessionUser["role"];

const ROLES: { id: Role; label: string; icon: typeof Shield }[] = [
  { id: "admin", label: "Administrator", icon: Shield },
  { id: "faculty", label: "Faculty", icon: GraduationCap },
  { id: "student", label: "Student", icon: User },
];

const DEMO_CREDS: Record<Role, { email: string; password: string }> = {
  admin: { email: "admin@git.edu.in", password: "admin123" },
  faculty: { email: "rajesh.sharma@git.edu.in", password: "faculty123" },
  student: { email: "cse22001@git.edu.in", password: "CSE22001" },
};

const DASHBOARD_PATH: Record<Role, string> = {
  admin: "/admin",
  faculty: "/faculty",
  student: "/student",
};

const formVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState(DEMO_CREDS.admin.email);
  const [password, setPassword] = useState(DEMO_CREDS.admin.password);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setEmail(DEMO_CREDS[newRole].email);
    setPassword(DEMO_CREDS[newRole].password);
  };

  const handleCopyCreds = async () => {
    const creds = DEMO_CREDS[role];
    await navigator.clipboard.writeText(
      `Email: ${creds.email}\nPassword: ${creds.password}`
    );
    setCopied(true);
    toast.success("Credentials copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const session = login(email, password, role);

    if (session) {
      toast.success(`Welcome back, ${session.name.split(" ")[0]}!`);
      router.push(DASHBOARD_PATH[role]);
    } else {
      toast.error("Invalid email or password. Please try again.");
      setLoading(false);
    }
  };

  const creds = DEMO_CREDS[role];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-12">
      <div
        className="animate-float-orb pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl"
        aria-hidden
      />
      <div
        className="animate-float-orb-slow pointer-events-none absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-purple-600/25 blur-3xl"
        aria-hidden
      />
      <div
        className="animate-float-orb-fast pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-indigo-950/50 backdrop-blur-2xl"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 shadow-lg shadow-indigo-500/30"
          >
            <GraduationCap className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Campus Attendance System
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            AI-Powered Attendance for Modern Universities
          </p>
        </div>

        <div className="relative mb-8 flex rounded-xl bg-white/5 p-1">
          <motion.div
            layoutId="role-tab-bg"
            className="absolute inset-y-1 rounded-lg bg-white/10"
            style={{
              width: `calc(${100 / ROLES.length}% - 4px)`,
              left: `calc(${(ROLES.findIndex((r) => r.id === role) * 100) / ROLES.length}% + 2px)`,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleRoleChange(r.id)}
              className={cn(
                "relative z-10 flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors sm:text-sm",
                role === r.id
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <span className="flex items-center gap-1.5">
                <r.icon className="h-4 w-4" />
                {r.label}
              </span>
              {role === r.id && (
                <motion.div
                  layoutId="role-underline"
                  className="h-0.5 w-3/4 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                />
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            <motion.div
              key={role}
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-5"
            >
              <motion.div variants={fieldVariants} className="relative">
                <Mail className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  className="peer w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-11 pr-4 text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/30"
                  placeholder=" "
                />
                <label
                  htmlFor="email"
                  className={cn(
                    "pointer-events-none absolute left-11 transition-all duration-200",
                    emailFocused || email
                      ? "-top-2.5 left-3 bg-[#12121f] px-2 text-xs text-indigo-400"
                      : "top-4 text-sm text-slate-500"
                  )}
                >
                  Email address
                </label>
              </motion.div>

              <motion.div variants={fieldVariants} className="relative">
                <Lock className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  className="peer w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-11 pr-12 text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/30"
                  placeholder=" "
                />
                <label
                  htmlFor="password"
                  className={cn(
                    "pointer-events-none absolute left-11 transition-all duration-200",
                    passwordFocused || password
                      ? "-top-2.5 left-3 bg-[#12121f] px-2 text-xs text-indigo-400"
                      : "top-4 text-sm text-slate-500"
                  )}
                >
                  {role === "student" ? "Password (Enrollment No)" : "Password"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-slate-300">
                <p className="mb-1 font-medium text-indigo-300">
                  Demo {ROLES.find((r) => r.id === role)?.label} credentials
                </p>
                <p>
                  <span className="text-slate-500">Email:</span> {creds.email}
                </p>
                <p>
                  <span className="text-slate-500">Password:</span>{" "}
                  {creds.password}
                </p>
                {role === "student" && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tip: student password = enrollment number (case-sensitive)
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyCreds}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-white/15"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy
              </button>
            </div>
          </motion.div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/25 transition disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500">
          Powered by AI · Face Recognition · Dynamic QR
        </p>
      </motion.div>
    </div>
  );
}
