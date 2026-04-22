import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { paymentSchemaWithId } from "@/schemas/payment-schema";

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

// PATCH - Update Payment and adjust balance receipt
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = paymentSchemaWithId.safeParse({ id, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data; void _omitId;

    // Check both collections to find the payment
    let oldPayment = await prisma.customerPayment.findUnique({ 
      where: { id },
      include: { customer: true }
    });
    
    if (!oldPayment) {
      oldPayment = await prisma.paymentHistory.findUnique({ 
        where: { id },
        include: { customer: true, supplier: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
    }
    
    if (!oldPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const oldDate = new Date(oldPayment.paidOn);
    const newDate = new Date(data.paidOn);
    // Handle different field names between CustomerPayment and PaymentHistory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldAmount = 'amount' in oldPayment ? (oldPayment as any).amount : (oldPayment as any).paidAmount;
    const amountDiff = data.paidAmount - oldAmount; // positive = increase, negative = decrease
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerId = 'customerId' in oldPayment ? (oldPayment as any).customerId : (oldPayment as any).customerId || (oldPayment as any).supplierId;

    const [updatedPayment] = await prisma.$transaction(async (tx) => {
      // 1. Update payment in both CustomerPayment and PaymentHistory collections
      let customerPaymentUpdated = null;
      let paymentHistoryUpdated = null;
      
      // Check if payment exists in CustomerPayment
      const customerPayment = await tx.customerPayment.findUnique({ where: { id } });
      if (customerPayment) {
        // Map fields for CustomerPayment model
        const customerPaymentData = {
          customerId: data.customerId,
          amount: data.paidAmount, // Map paidAmount to amount
          paymentMethod: data.paymentMethod,
          paidOn: data.paidOn,
          branchId: data.branchId,
        };
        customerPaymentUpdated = await tx.customerPayment.update({
          where: { id },
          data: customerPaymentData,
        });
      }
      
      // Check if payment exists in PaymentHistory
      const paymentHistory = await tx.paymentHistory.findUnique({ where: { id } });
      if (paymentHistory) {
        paymentHistoryUpdated = await tx.paymentHistory.update({
          where: { id },
          data,
        });
      }
      
      // Use the first available updated record
      const updated = customerPaymentUpdated || paymentHistoryUpdated;

      // 2. Adjust customer outstanding balance based on amount difference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (customerId && ('customerId' in oldPayment ? (oldPayment as any).customerId : (oldPayment as any).customerId)) {
        // For customer payments, adjust outstanding balance (REVERSED LOGIC)
        if (amountDiff > 0) {
          // Amount increased, so customer owes LESS (decrement outstanding)
          await tx.customer.update({
            where: { id: customerId },
            data: {
              outstandingPayments: { decrement: amountDiff }
            }
          });
        } else if (amountDiff < 0) {
          // Amount decreased, so customer owes MORE (increment outstanding)
          await tx.customer.update({
            where: { id: customerId },
            data: {
              outstandingPayments: { increment: Math.abs(amountDiff) }
            }
          });
        }
      }

      // 3. Adjust BalanceReceipt using IST-aware logic
      if (oldPayment.branchId) {
        if (oldDate.toDateString() === newDate.toDateString()) {
          // Same date → update balance by the difference
          if (amountDiff !== 0) {
            await updateBalanceReceiptForPaymentIST(
              oldPayment.branchId, 
              oldDate, 
              amountDiff,
              tx
            );
          }
        } else {
          // Date changed → reverse from old, apply to new
          // 3a. Restore old balance (cancel the old payment)
          await updateBalanceReceiptForPaymentIST(
            oldPayment.branchId,
            oldDate,
            -oldAmount,
            tx
          );
          
          // 3b. Add to new balance (apply the updated payment)
          await updateBalanceReceiptForPaymentIST(
            oldPayment.branchId,
            newDate,
            data.paidAmount,
            tx
          );
        }
      }

      return [updated];
    });

    return NextResponse.json({ data: updatedPayment }, { status: 200 });
  } catch (error) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove payment and decrement from balance receipt
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    // Check both collections to find the payment
    let oldPayment = await prisma.customerPayment.findUnique({
      where: { id },
      include: { customer: true }
    });
    
    if (!oldPayment) {
      oldPayment = await prisma.paymentHistory.findUnique({
        where: { id },
        include: { customer: true, supplier: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
    }

    if (!oldPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const paymentDate = new Date(oldPayment.paidOn);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldAmount = 'amount' in oldPayment ? (oldPayment as any).amount : (oldPayment as any).paidAmount;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerId = 'customerId' in oldPayment ? (oldPayment as any).customerId : (oldPayment as any).customerId || (oldPayment as any).supplierId;

    const [deletedPayment] = await prisma.$transaction(async (tx) => {
      // 1. Delete from both collections if they exist
      let removed;
      
      const customerPayment = await tx.customerPayment.findUnique({ where: { id } });
      if (customerPayment) {
        removed = await tx.customerPayment.delete({ where: { id } });
      }
      
      const paymentHistory = await tx.paymentHistory.findUnique({ where: { id } });
      if (paymentHistory) {
        if (!customerPayment) {
          removed = await tx.paymentHistory.delete({ where: { id } });
        } else {
          await tx.paymentHistory.delete({ where: { id } });
        }
      }

      // 2. Restore customer outstanding balance
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            outstandingPayments: { increment: oldAmount }
          }
        });
      }

      // 3. Decrement from BalanceReceipt with automated ripple
      if (oldPayment.branchId) {
        await updateBalanceReceiptForPaymentIST(
          oldPayment.branchId,
          paymentDate,
          -oldAmount, // Subtract the payment amount that is being deleted
          tx
        );
      }

      return [removed];
    });

    return NextResponse.json({ data: deletedPayment }, { status: 200 });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
