import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { supplierPaymentSchema } from "@/schemas/supplier-payment-schema";
import { createLog } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const result = supplierPaymentSchema.safeParse(body);
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

    const { supplierId, amount, paymentMethod, paidOn } = result.data;

    // Run everything in one transaction
    const [payment, paymentHistory] = await prisma.$transaction([
      prisma.supplierPayment.create({
      data: {
        ...result.data,
        branchId
      },
      }),

      prisma.supplier.update({
        where: { id: supplierId },
        data: {
          outstandingPayments: {
            decrement: amount,
          },
        },
      }),

      prisma.paymentHistory.create({
        data: {
          supplierId,
          branchId,
          paymentMethod: paymentMethod,
          paidAmount: amount,
          paidOn: paidOn,
          // description is supported in schema; keep out of type until client is regenerated
        },
      }),
    ]);

    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'CREATE',
        module: 'PurchasePayments',
        details: { id: payment.id, amount: payment.amount, supplierId: payment.supplierId }
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
