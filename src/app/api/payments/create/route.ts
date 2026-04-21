import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { customerPaymentSchema } from "@/schemas/payment-schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { updateBalanceReceiptForPaymentIST } from "@/lib/ist-balance-utils";
import { createLog } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const result = customerPaymentSchema.safeParse(body);
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

    const { customerId, amount, paymentMethod, paidOn, description } = result.data;

    // ✅ Validate date is not present or future (only allow past dates)
    const { getCurrentDateIST } = await import("@/lib/date-utils");
    const currentDate = getCurrentDateIST();
    const inputDate = new Date(paidOn);
    // Compare dates (ignore time)
    const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    if (inputDateOnly >= currentDateOnly) {
      return NextResponse.json(
        { error: "Cannot store payment for present or future dates. Only past dates are allowed." },
        { status: 400 }
      );
    }

    // Run everything in one transaction
    const [payment, paymentHistory] = await prisma.$transaction(async (tx) => {
      // 1. Create customer payment
      const createdPayment = await tx.customerPayment.create({
        data: {
          ...result.data,
          branchId
        },
      });

      // 2. Update customer outstanding (decrement)
      await tx.customer.update({
        where: { id: customerId },
        data: {
          outstandingPayments: {
            decrement: amount,
          },
        },
      });

      // 3. Create payment history with the same ID as CustomerPayment
      const createdPaymentHistory = await tx.paymentHistory.create({
        data: {
          id: createdPayment.id, // Use the same ID as CustomerPayment
          customerId,
          branchId,
          paymentMethod: paymentMethod,
          paidAmount: amount,
          paidOn: paidOn,
          description,
        },
      });

      // 4. Update BalanceReceipt for payment (positive amount = cash received from customer)
      if (branchId) {
        await updateBalanceReceiptForPaymentIST(branchId, new Date(paidOn), amount, tx);
      }

      return [createdPayment, createdPaymentHistory];
    });

    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'CREATE',
        module: 'Payments',
        details: { id: payment.id, amount: payment.amount, customerId: payment.customerId }
    });

    revalidatePath("/payments");

    return NextResponse.json({ data: payment, history: paymentHistory }, { status: 201 });
  } catch (error) {
    console.error("Error creating payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
