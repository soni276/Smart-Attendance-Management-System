"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { seedDemoData } from "@/lib/seed";
import { KEYS } from "@/lib/storage";

function alreadyInitialized(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEYS.INITIALIZED) === "true";
  } catch {
    return false;
  }
}

function migrateLegacyKeysIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    // If we already have v2 marker, no work to do.
    if (localStorage.getItem(KEYS.INITIALIZED) === "true") return;

    // If a v1 (school) install exists, wipe it so v2 college seed runs cleanly.
    const hadLegacy =
      localStorage.getItem("sas_initialized") === "true" ||
      localStorage.getItem("sas_classes") !== null ||
      localStorage.getItem("sas_teachers") !== null;

    if (hadLegacy) {
      const session = localStorage.getItem("sas_session_user");
      [
        "sas_initialized",
        "sas_classes",
        "sas_teachers",
        "sas_admins",
        "sas_students",
        "sas_attendance",
        "sas_qr_sessions",
        "sas_chat_history",
        "sas_few_shots",
        "sas_settings",
        "sas_anomalies",
      ].forEach((k) => localStorage.removeItem(k));
      if (session) localStorage.setItem("sas_session_user", session);
    }
  } catch {
    // ignore
  }
}

export function SeedProvider({ children }: { children: React.ReactNode }) {
  const [seeding, setSeeding] = useState(() => {
    if (typeof window !== "undefined") migrateLegacyKeysIfNeeded();
    return !alreadyInitialized();
  });

  useEffect(() => {
    if (!seeding) return;
    seedDemoData();
    setSeeding(false);
  }, [seeding]);

  if (seeding) {
    return <LoadingScreen message="Initializing Campus Attendance System..." />;
  }

  return <>{children}</>;
}
