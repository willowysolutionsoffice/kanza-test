import { NextRequest, NextResponse } from "next/server";
import { userFormSchema } from "@/schemas/user-schema";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = userFormSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, role, branch, canEdit } = result.data;

    const { user } = await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role: role as "admin" | "user",
        data: {
          branch,
          canEdit,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "User created successfully", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
