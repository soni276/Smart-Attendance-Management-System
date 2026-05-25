import type { NextRequest } from "next/server";
import { initServerStore } from "@/lib/server-init";

export async function parseApiBody<T>(request: NextRequest): Promise<T> {
  return (await request.json()) as T;
}

export function prepareStore(body: {
  _store?: Record<string, unknown>;
}): void {
  try {
    initServerStore(body._store);
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn(
        "[api-utils] prepareStore failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  }
}

export { buildClientStoreSnapshot } from "@/lib/client-store";
