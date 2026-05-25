/** Client-safe helpers for syncing localStorage with API routes */

export function buildClientStoreSnapshot(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const keys = [
    "sas_students",
    "sas_faculty",
    "sas_admins",
    "sas_courses",
    "sas_attendance",
    "sas_qr_sessions",
    "sas_settings",
    "sas_anomalies",
    "sas_few_shots",
    "sas_chat_history",
  ];
  const store: Record<string, string> = {};
  for (const key of keys) {
    const val = localStorage.getItem(key);
    if (val) store[key] = val;
  }
  return store;
}
