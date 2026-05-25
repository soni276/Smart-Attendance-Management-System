"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { seedDemoData } from "@/lib/seed";

function alreadyInitialized(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("sas_initialized") === "true";
  } catch {
    return false;
  }
}

export function SeedProvider({ children }: { children: React.ReactNode }) {
  const [seeding, setSeeding] = useState(() => !alreadyInitialized());

  useEffect(() => {
    if (!seeding) return;
    seedDemoData();
    setSeeding(false);
  }, [seeding]);

  if (seeding) {
    return <LoadingScreen message="Initializing Smart Attendance System..." />;
  }

  return <>{children}</>;
}
