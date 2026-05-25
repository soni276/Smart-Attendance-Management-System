import type { NextRequest } from "next/server";
import { initServerStore } from "@/lib/server-init";

export async function parseApiBody<T>(request: NextRequest): Promise<T> {
  return (await request.json()) as T;
}

export function prepareStore(
  body: { _store?: Record<string, unknown> }
): void {
  initServerStore(body._store);
}

export { buildClientStoreSnapshot } from "@/lib/client-store";
