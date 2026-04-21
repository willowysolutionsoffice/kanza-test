import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLog } from "@/lib/logger";
import { headers } from "next/headers";

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (session?.user) {
        await createLog({
            userId: session.user.id,
            userEmail: session.user.email,
            userName: session.user.name,
            action: 'LOGOUT',
            module: 'AUTH',
            ipAddress: session.session.ipAddress || '',
            userAgent: session.session.userAgent || '',
        });
    }

    const res = NextResponse.json(
      { success: true, message: "Logged out" },
      { status: 200 }
    );

    // Clear auth cookies
    res.cookies.delete("better-auth.session_token");
    res.cookies.delete("session_token");
    res.cookies.delete("auth.session-token");

    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}
