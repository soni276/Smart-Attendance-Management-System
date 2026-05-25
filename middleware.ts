import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SessionUser } from "@/types";

const SESSION_COOKIE = "sas_session";

function getDashboardPath(role: SessionUser["role"]): string {
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

function parseSession(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (session?.userId && session?.role && session?.token) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

function getRequiredRole(pathname: string): SessionUser["role"] | null {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student")) return "student";
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const session = parseSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(getDashboardPath(session.role), request.url)
      );
    }
    return NextResponse.next();
  }

  if (
    pathname === "/scan" ||
    pathname.startsWith("/scan/")
  ) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (session) {
      return NextResponse.redirect(
        new URL(getDashboardPath(session.role), request.url)
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requiredRole = getRequiredRole(pathname);

  if (requiredRole) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (session.role !== requiredRole) {
      return NextResponse.redirect(
        new URL(getDashboardPath(session.role), request.url)
      );
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", session.userId);
    response.headers.set("x-user-role", session.role);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
