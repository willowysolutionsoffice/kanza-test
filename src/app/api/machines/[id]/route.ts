import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { machineSchemaWithId } from "@/schemas/machine-schema";
import { ObjectId } from "mongodb";
import { createLog } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
    const body = await req.json();
    const parsed = machineSchemaWithId.safeParse({ id: (await params).id, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id, machineTanks, ...rest } = parsed.data;

    const machines = await prisma.machine.update({
      where: { id },
      data: {
        ...rest,
        machineTanks: {
          deleteMany: {},
          create: machineTanks.map(tankId => ({
            tank: { connect: { id: tankId } }
          })),
        },
      },
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'UPDATE',
        module: 'Machines',
        details: { id, name: rest.machineName }
    });

    return NextResponse.json({ data: machines }, { status: 200 });
  } catch (error) {
    console.error("Error updating machines:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

//DELETE
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid ID format" },
      { status: 400 }
    );
  }

  try {
    const deletedMachines = await prisma.machine.delete({
      where: { id },
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'DELETE',
        module: 'Machines',
        details: { id, deletedData: deletedMachines }
    });

    return NextResponse.json({ data: deletedMachines }, { status: 200 });
  } catch (error) {
    console.error("Error deleting machine:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
