import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import { SessionResponse } from "@/types/auth";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  // 1. Logging Logic
  // Avoid logging the logger itself to prevent infinite loops
  if (!pathname.startsWith("/api/logger")) {
      const isApi = pathname.startsWith("/api");
      const isServerAction = request.headers.has("next-action");
      
      if ((isApi || isServerAction) && request.method !== "GET") {
          const logType = isServerAction ? "SERVER_ACTION" : "API";
          // We must use fetch to call the API route because we are in Edge Runtime
          const logPromise = fetch(new URL("/api/logger", request.url), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  message: `${request.method} ${pathname} ${isServerAction ? '(Action ID: ' + request.headers.get("next-action") + ')' : ''}`,
                  type: logType,
                  source: "Middleware"
              })
          }).catch(err => console.error("Logging failed", err));

          event.waitUntil(logPromise);
      }
  }

  // 2. Original Auth Logic
  // Only run this for paths that were originally matched (NOT api, NOT login, NOT root)
  const isExcludedFromAuth = 
      pathname.startsWith("/api") || 
      pathname.startsWith("/login") || 
      pathname === "/" ||
      pathname.startsWith("/_next") || 
      pathname === "/favicon.ico";

  if (!isExcludedFromAuth) {
    const response = await betterFetch<SessionResponse>(
        "/api/auth/get-session",
        {
        baseURL: process.env.BETTER_AUTH_URL!,
        headers: {
            cookie: request.headers.get("cookie") || "",
        },
        },
    );


    const { session, user } = response.data?.data || {};

    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (request.nextUrl.pathname.startsWith("/admin")) {
        const userRole = user?.role?.toLowerCase();
        if (userRole !== "admin" && userRole !== "gm") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
