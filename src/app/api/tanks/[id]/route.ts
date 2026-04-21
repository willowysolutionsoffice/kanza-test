import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { tankSchemaWithId } from "@/schemas/tank-schema";
import { ObjectId } from "mongodb";
import { Prisma } from "@prisma/client";
import { createLog } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = tankSchemaWithId.safeParse({ id, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data; void _omitId;

    const tank = await prisma.tank.update({
      where: { id },
      data,
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'UPDATE',
        module: 'Tanks',
        details: { id, changes: data }
    });

    return NextResponse.json({ data: tank }, { status: 200 });
  } catch (error) {
    console.error("Error updating tank:", error);
    
    // Check if it's a unique constraint violation (duplicate tank name)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const target = error.meta?.target as string[] | undefined;
        if (target && target.includes('tankName')) {
          return NextResponse.json(
            { error: `A tank with the name already exists in other branch. Please choose a different name.` },
            { status: 400 }
          );
        }
      }
    }
    
    // Check for MongoDB duplicate key error
    if (error instanceof Error && (error.message.includes('E11000') || error.message.includes('duplicate'))) {
      return NextResponse.json(
        { error: `A tank with this name already exists in other branch. Please choose a different name.` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

//DELETE
export async function DELETE(
  _req: Request,
  context: unknown
) {
  const params = (context as { params?: { id?: string } })?.params ?? {};
  const id = typeof params.id === "string" ? params.id : null;

  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid ID format" },
      { status: 400 }
    );
  }

  try {
    const deletedTank = await prisma.tank.delete({
      where: { id },
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'DELETE',
        module: 'Tanks',
        details: { id, deletedData: deletedTank }
    });

    return NextResponse.json({ data: deletedTank }, { status: 200 });
  } catch (error) {
    console.error("Error deleting tank:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
