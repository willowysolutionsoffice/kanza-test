import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { salesSchemaWithId } from "@/schemas/sales-schema";
import { revalidatePath } from "next/cache";
import { updateBalanceReceiptIST } from "@/lib/ist-balance-utils";
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
    const { id: saleId } = await params;
    const body = await req.json();
    
    // Transform empty strings to null for nullable payment fields
    const transformedBody = {
      ...body,
      atmPayment: body.atmPayment === "" ? null : body.atmPayment,
      paytmPayment: body.paytmPayment === "" ? null : body.paytmPayment,
      fleetPayment: body.fleetPayment === "" ? null : body.fleetPayment,
    };
    
    const result = salesSchemaWithId.safeParse({ id: saleId, ...transformedBody });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Fetch existing sale
    const existingSale = await prisma.sale.findUnique({
      where: { id: saleId },
    });
    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Remove id before update and transform empty strings to null
    const { id, ...saleDataRaw } = result.data;
    
    const saleData = {
      ...saleDataRaw,
      atmPayment: saleDataRaw.atmPayment === "" ? null : (saleDataRaw.atmPayment ?? null),
      paytmPayment: saleDataRaw.paytmPayment === "" ? null : (saleDataRaw.paytmPayment ?? null),
      fleetPayment: saleDataRaw.fleetPayment === "" ? null : (saleDataRaw.fleetPayment ?? null),
    };

    const oldCash = existingSale.cashPayment ?? 0;
    const newCash = saleData.cashPayment ?? 0;
    const diff = newCash - oldCash; // +ve = more cash, -ve = less cash

    const oldDate = new Date(existingSale.date);
    const newDate = new Date(saleData.date);

    const [updatedSale] = await prisma.$transaction(async (tx) => {
      // 1. Update sale
      const updated = await tx.sale.update({
        where: { id },
        data: {
          ...saleData,
          products: saleData.products ?? {},
        } as Prisma.SaleUpdateInput,
      });

      // 2. Adjust BalanceReceipt using IST-aware logic
      if (existingSale.branchId) {
        if (oldDate.toDateString() === newDate.toDateString()) {
          // Same date → update balance by the difference
          if (diff !== 0) {
            await updateBalanceReceiptIST(
              existingSale.branchId, 
              existingSale.date, 
              diff,
              tx
            );
          }
        } else {
          // Date changed → restore entire amount to old receipt, deduct from new receipt
          // 2a. Restore old balance (cancel the old cash payment)
          await updateBalanceReceiptIST(
            existingSale.branchId,
            oldDate,
            -oldCash,
            tx
          );
          
          // 2b. Deduct from new balance (add the new cash payment)
          await updateBalanceReceiptIST(
            existingSale.branchId,
            newDate,
            newCash,
            tx
          );
        }
      }

      return [updated];
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'UPDATE',
      module: 'Sales',
      details: { id: saleId, changes: saleData }
    });

    revalidatePath("/sales");
    return NextResponse.json({ data: updatedSale }, { status: 200 });
  } catch (error) {
    console.error("Error updating sale:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saleId } = await params;

    // Fetch sale first
    const existingSale = await prisma.sale.findUnique({
      where: { id: saleId },
    });
    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete sale
      await tx.sale.delete({
        where: { id: saleId },
      });

      // 2. Adjust BalanceReceipt using IST-aware logic (remove the cash payment from the balance)
      if (existingSale.cashPayment && existingSale.branchId) {
        await updateBalanceReceiptIST(
          existingSale.branchId, 
          existingSale.date, 
          -existingSale.cashPayment, 
          tx
        );
      }
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'DELETE',
      module: 'Sales',
      details: { id: saleId, deletedData: existingSale }
    });

    revalidatePath("/sales");
    return NextResponse.json(
      { message: "Sale deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting sale:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}