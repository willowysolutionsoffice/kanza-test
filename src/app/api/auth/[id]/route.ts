import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.string().optional(),
  branch: z.string().optional(),
  canEdit: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, role, branch } = result.data;

    // Update user via better-auth admin API if needed
    // For now, update directly via prisma for additional fields
    const updateData: {
      name?: string;
      email?: string;
      role?: string;
      branch?: string;
      canEdit?: boolean;
    } = {};
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (branch !== undefined) updateData.branch = branch;
    if (body.canEdit !== undefined) updateData.canEdit = body.canEdit;

    // Update via prisma for additional fields
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: updateData,
      });
    }

    // If email or name changed, update via better-auth
    if (name || email) {
      try {
        await auth.api.updateUser({
          body: {
            ...(name && { name }),
            ...(email && { email }),
          },
          headers: {
            // better-auth may need user context from session
          },
        });
      } catch (error) {
        console.error("Error updating user via auth:", error);
        // Continue even if auth update fails, prisma update should work
      }
    }

    return NextResponse.json(
      { success: true, message: "User updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
