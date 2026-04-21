import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { balanceReceiptSchemaWithId } from "@/schemas/balance-receipt";
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
    const parsed = balanceReceiptSchemaWithId.safeParse({ id, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data; void _omitId;

    const balanceReceipt = await prisma.balanceReceipt.update({
      where: { id },
      data,
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'UPDATE',
      module: 'BalanceReceipts',
      details: { id, changes: data }
    });

    return NextResponse.json({ data: balanceReceipt }, { status: 200 });
  } catch (error) {
    console.error("Error updating balance Receipt:", error);
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
    const deletedBalanceReceipt = await prisma.balanceReceipt.delete({
      where: { id },
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'DELETE',
      module: 'BalanceReceipts',
      details: { id, deletedData: deletedBalanceReceipt }
    });

    return NextResponse.json({ data: deletedBalanceReceipt }, { status: 200 });
  } catch (error) {
    console.error("Error deleting balance Receipt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
