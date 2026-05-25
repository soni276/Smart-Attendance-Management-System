import "server-only";

import { runSeed } from "@/lib/seed";
import {
  KEYS,
  getAll,
  saveMany,
  saveSettings,
} from "@/lib/storage-server";

export function seedServerData(): void {
  runSeed({
    KEYS,
    saveMany,
    saveSettings,
    isInitialized: () => getAll(KEYS.STUDENTS).length > 0,
    markInitialized: () => {},
  });
}
