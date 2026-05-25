"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { getCurrentUser } from "@/lib/storage";

function dashboardHref(): string {
  const user = getCurrentUser();
  if (!user) return "/login";
  switch (user.role) {
    case "admin":
      return "/admin";
    case "faculty":
      return "/faculty";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}

export default function NotFound() {
  const href = dashboardHref();
  const label = href === "/login" ? "Back to login" : "Back to dashboard";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <p className="font-display text-8xl font-bold bg-gradient-to-br from-indigo-400 to-purple-500 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-white">
          Page not found
        </h1>
        <p className="mt-2 max-w-md text-slate-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href={href}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          <Home className="h-4 w-4" />
          {label}
        </Link>
      </motion.div>
    </div>
  );
}
