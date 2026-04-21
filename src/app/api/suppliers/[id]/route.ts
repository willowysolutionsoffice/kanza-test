import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { supplierSchemaWithId } from "@/schemas/supplier-schema";
import { ObjectId } from "mongodb";
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
    const parsed = supplierSchemaWithId.safeParse({ id, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data; void _omitId;

    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'UPDATE',
        module: 'Suppliers',
        details: { id, changes: data }
    });

    return NextResponse.json({ data: supplier }, { status: 200 });
  } catch (error) {
    console.error("Error updating supplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

//DELETE
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    // Check if supplier has related records
    const relatedRecords = await Promise.all([
      prisma.stock.count({ where: { supplierId: id } }),
      prisma.purchase.count({ where: { supplierId: id } }),
      prisma.supplierPayment.count({ where: { supplierId: id } }),
      prisma.tank.count({ where: { supplierId: id } }),
      prisma.purchaseOrder.count({ where: { supplierId: id } }),
      prisma.paymentHistory.count({ where: { supplierId: id } }),
    ]);

    const totalRelatedRecords = relatedRecords.reduce((sum, count) => sum + count, 0);

    if (totalRelatedRecords > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete supplier. This supplier has related records (stock, purchases, payments, tanks, or orders). Please remove or reassign these records first." 
        },
        { status: 400 }
      );
    }

    const deletedSupplier = await prisma.supplier.delete({
      where: { id },
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'DELETE',
        module: 'Suppliers',
        details: { id, deletedData: deletedSupplier }
    });

    return NextResponse.json({ data: deletedSupplier }, { status: 200 });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
