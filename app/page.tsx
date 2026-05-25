import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/types";

function dashboardForRole(role: SessionUser["role"]): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}

export default async function Home() {
  const store = await cookies();
  const raw = store.get("sas_session")?.value;
  if (raw) {
    try {
      const session = JSON.parse(decodeURIComponent(raw)) as SessionUser;
      if (session?.userId && session?.role && session?.token) {
        redirect(dashboardForRole(session.role));
      }
    } catch {
      // fall through
    }
  }
  redirect("/login");
}
