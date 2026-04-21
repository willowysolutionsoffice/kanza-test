import { prisma } from "@/lib/prisma";
import { ObjectId } from "mongodb";
import { bankDepositeSchemaWithId } from "@/schemas/bank-deposite-schema";
import { NextResponse } from "next/server";
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
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const body = await req.json();
    
    // Filter out empty strings that could cause ObjectID issues
    const cleanedBody = Object.fromEntries(
      Object.entries(body).filter(([key, value]) => {
        if (value === "" || value === null || value === undefined) {
          return false;
        }
        return true;
      })
    );
    
    const parsed = bankDepositeSchemaWithId.safeParse({ id, ...cleanedBody });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data;
    void _omitId;
    
    // Validate ObjectIDs before proceeding
    if (data.bankId && !ObjectId.isValid(data.bankId)) {
      return NextResponse.json({ error: "Invalid bankId format" }, { status: 400 });
    }
    if (data.branchId && !ObjectId.isValid(data.branchId)) {
      return NextResponse.json({ error: "Invalid branchId format" }, { status: 400 });
    }

    const existingDeposite = await prisma.bankDeposite.findUnique({
      where: { id },
    });

    if (!existingDeposite) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    const oldAmount = existingDeposite.amount;
    const newAmount = data.amount;
    const difference = newAmount - oldAmount;

    const oldDate = new Date(existingDeposite.date);
    const newDate = new Date(data.date);

    const [bankDeposite] = await prisma.$transaction(async (tx) => {
      // 1. Update deposit
      const updatedDeposit = await tx.bankDeposite.update({
        where: { id },
        data,
      });

      // 2. Update bank balance
      if (difference !== 0) {
        if (difference > 0) {
          await tx.bank.update({
            where: { id: existingDeposite.bankId },
            data: { balanceAmount: { increment: difference } },
          });
        } else {
          await tx.bank.update({
            where: { id: existingDeposite.bankId },
            data: { balanceAmount: { decrement: Math.abs(difference) } },
          });
        }
      }

      // 3. Adjust BalanceReceipt with IST-aware propagation
      if (oldDate.toDateString() === newDate.toDateString()) {
        // Same date → adjust only by difference (negative because deposit reduces cash)
        if (difference !== 0 && existingDeposite.branchId) {
          await updateBalanceReceiptIST(
            existingDeposite.branchId,
            oldDate,
            -difference,
            tx
          );
        }
      } else {
        // Date changed → restore old, apply new
        if (existingDeposite.branchId) {
          // Restore old (add back deposit amount)
          await updateBalanceReceiptIST(
            existingDeposite.branchId,
            oldDate,
            oldAmount,
            tx
          );
          
          // Apply new (subtract new deposit amount)
          await updateBalanceReceiptIST(
            existingDeposite.branchId,
            newDate,
            -newAmount,
            tx
          );
        }
      }

      return [updatedDeposit];
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'UPDATE',
        module: 'BankDeposits',
        details: { id, changes: data }
    });

    return NextResponse.json({ data: bankDeposite }, { status: 200 });
  } catch (error) {
    console.error("Error updating bank deposit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const existingDeposite = await prisma.bankDeposite.findUnique({
      where: { id },
    });

    if (!existingDeposite) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    const depositDate = new Date(existingDeposite.date);

    const [deletedBankDeposite] = await prisma.$transaction(async (tx) => {
      // 1. Delete deposit
      const removedDeposit = await tx.bankDeposite.delete({ where: { id } });

      // 2. Decrement bank balance
      await tx.bank.update({
        where: { id: existingDeposite.bankId },
        data: { balanceAmount: { decrement: existingDeposite.amount } },
      });

      // 3. Increment back in BalanceReceipt (since deletion cancels earlier decrement)
      if (existingDeposite.branchId) {
        await updateBalanceReceiptIST(
          existingDeposite.branchId,
          depositDate,
          existingDeposite.amount, // Refund the cash
          tx
        );
      }

      return [removedDeposit];
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'DELETE',
        module: 'BankDeposits',
        details: { id, deletedData: existingDeposite }
    });

    return NextResponse.json({ data: deletedBankDeposite }, { status: 200 });
  } catch (error) {
    console.error("Error deleting bank deposit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
