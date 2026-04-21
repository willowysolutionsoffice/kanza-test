import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { expenseSchema } from "@/schemas/expense-schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { updateBalanceReceiptIST } from "@/lib/ist-balance-utils";
import { createLog } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ✅ Validate input
    const result = expenseSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Use branchId from form data if provided, otherwise fall back to session branch
    const branchId = result.data.branchId || session?.user?.branch;
    const { bankId, amount, date } = result.data;

    // ✅ Validate date is not present or future (only allow past dates)
    const { getCurrentDateIST } = await import("@/lib/date-utils");
    const currentDate = getCurrentDateIST();
    const inputDate = new Date(date);
    // Compare dates (ignore time)
    const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    if (inputDateOnly >= currentDateOnly) {
      return NextResponse.json(
        { error: "Cannot store expense for present or future dates. Only past dates are allowed." },
        { status: 400 }
      );
    }

    const expense = await prisma.$transaction(async (tx) => {
      // 1. Create expense
      const newExpense = await tx.expense.create({
        data: {
          ...result.data,
          branchId,
        },
      });

      // 2. Decrement from bank (if bankId present)
      if (bankId) {
        await tx.bank.update({
          where: { id: bankId },
          data: {
            balanceAmount: {
              decrement: amount,
            },
          },
        });
      }

      // 3. Update BalanceReceipt (negative amount = cash spent)
      if (branchId) {
        await updateBalanceReceiptIST(branchId, date, -amount, tx);
      }

      return newExpense;
    });

    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'CREATE',
      module: 'Expenses',
      details: { id: expense.id, description: expense.description, amount: expense.amount }
    });

    revalidatePath("/expenses");
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
