import "server-only";

import { seedServerData } from "@/lib/seed-server";
import { KEYS, getAll, syncFromClientStore } from "@/lib/storage-server";

export function initServerStore(
  clientStore?: Record<string, unknown>
): void {
  syncFromClientStore(clientStore);
  if (getAll(KEYS.STUDENTS).length === 0) {
    seedServerData();
  }
}
