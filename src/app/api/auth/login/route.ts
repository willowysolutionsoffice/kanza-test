import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/schemas/user-schema";
import { auth } from "@/lib/auth";
import { createLog } from "@/lib/logger";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const signInResult = await auth.api.signInEmail({ body: { email, password } });

    if (!signInResult.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    
    // Log the successful login
    const reqHeaders = await headers();
    await createLog({
        userId: signInResult.user.id,
        userEmail: signInResult.user.email,
        userName: signInResult.user.name,
        action: 'LOGIN',
        module: 'AUTH',
        ipAddress: reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '',
        userAgent: reqHeaders.get('user-agent') || '',
    });

    return NextResponse.json(
      { success: true, message: "Login successful", redirectTo: "/dashboard" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }
}
