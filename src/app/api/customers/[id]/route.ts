import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { customerSchema } from "@/schemas/customers-schema";
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
    
    // Validate ObjectId format
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid customer ID format" },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const parsed = customerSchema.safeParse(body);  

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: parsed.data,
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'UPDATE',
        module: 'Customers',
        details: { id, changes: parsed.data }
    });

    return NextResponse.json({ data: customer }, { status: 200 });
  } catch (error) {
    console.error("Error updating customer:", error);
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
    // Check if customer has related records
    const relatedRecords = await Promise.all([
      prisma.credit.count({ where: { customerId: id } }),
      prisma.customerPayment.count({ where: { customerId: id } }),
      prisma.paymentHistory.count({ where: { customerId: id } }),
    ]);

    const totalRelatedRecords = relatedRecords.reduce((sum, count) => sum + count, 0);

    if (totalRelatedRecords > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete customer. This customer has related records (credits, payments, or payment history). Please remove or reassign these records first."
        },
        { status: 400 }
      );
    }

    const deletedCustomer = await prisma.customer.delete({
      where: { id },
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'DELETE',
        module: 'Customers',
        details: { id, deletedData: deletedCustomer }
    });

    return NextResponse.json({ data: deletedCustomer }, { status: 200 });
  } catch (error) {
    console.error("Error deleting customer:", error);
    
    // Handle foreign key constraint errors
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: "Cannot delete customer. This customer has related records that prevent deletion." },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
