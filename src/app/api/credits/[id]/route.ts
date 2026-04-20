import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { creditSchemaWithId } from "@/schemas/credit-schema";
import { updateBalanceReceiptIST } from "@/lib/ist-balance-utils";

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
    const parsed = creditSchemaWithId.safeParse({ id, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data;
    void _omitId;

    const existingCredit = await prisma.credit.findUnique({ where: { id } });
    if (!existingCredit) {
      return NextResponse.json({ error: "Credit not found" }, { status: 404 });
    }

    const oldAmount = existingCredit.amount;
    const newAmount = data.amount;
    const difference = newAmount - oldAmount; // +ve = credit increased, -ve = credit decreased

    const oldDate = new Date(existingCredit.date);
    const newDate = new Date(data.date);

    const [updatedCredit] = await prisma.$transaction(async (tx) => {
      // 1. Update credit record
      const updated = await tx.credit.update({
        where: { id },
        data,
      });

      // 2. Adjust customer outstanding
      if (difference !== 0) {
        if (difference > 0) {
          await tx.customer.update({
            where: { id: existingCredit.customerId },
            data: { outstandingPayments: { increment: difference } },
          });
        } else {
          await tx.customer.update({
            where: { id: existingCredit.customerId },
            data: { outstandingPayments: { decrement: Math.abs(difference) } },
          });
        }
      }

      // 3. Adjust BalanceReceipt with IST-aware propagation
      if (oldDate.toDateString() === newDate.toDateString()) {
        // Same date → just apply diff (negative because more credit = less cash)
        if (difference !== 0 && existingCredit.branchId) {
          await updateBalanceReceiptIST(
            existingCredit.branchId,
            oldDate,
            -difference,
            tx
          );
        }
      } else {
        // Date changed → restore old, apply new
        if (existingCredit.branchId) {
          // Restore old (add back old credit amount)
          await updateBalanceReceiptIST(
            existingCredit.branchId,
            oldDate,
            oldAmount,
            tx
          );
          
          // Apply new (subtract new credit amount)
          await updateBalanceReceiptIST(
            existingCredit.branchId,
            newDate,
            -newAmount,
            tx
          );
        }
      }

      return [updated];
    });

    return NextResponse.json({ data: updatedCredit }, { status: 200 });
  } catch (error) {
    console.error("Error updating credit:", error);
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
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const existingCredit = await prisma.credit.findUnique({
      where: { id },
    });

    if (!existingCredit) {
      return NextResponse.json({ error: "Credit not found" }, { status: 404 });
    }

    const creditDate = new Date(existingCredit.date);

    const [deletedCredit] = await prisma.$transaction(async (tx) => {
      // 1. Delete credit
      const removedCredit = await tx.credit.delete({ where: { id } });

      // 2. Adjust customer outstanding
      await tx.customer.update({
        where: { id: existingCredit.customerId },
        data: { outstandingPayments: { decrement: existingCredit.amount } },
      });

      // 3. Increment back in BalanceReceipt with ripple correction
      if (existingCredit.branchId) {
        await updateBalanceReceiptIST(
          existingCredit.branchId,
          creditDate,
          existingCredit.amount, // Refund the cash
          tx
        );
      }

      return [removedCredit];
    });

    return NextResponse.json({ data: deletedCredit }, { status: 200 });
  } catch (error) {
    console.error("Error deleting credit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
