import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purchaseSchema } from "@/schemas/purchase-schema";
import { createLog } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Zod validation
    const result = purchaseSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }


    const purchasePrice = result.data.purchasePrice

    const paidAmount = result.data.paidAmount

    const pendingAmount = purchasePrice - paidAmount
    

    // Create the purchase
    const purchase = await prisma.purchase.create({
      data: {
        ...result.data,
        pendingAmount,
        phone: result.data.phone || "",
      },
    });

    await prisma.supplier.update({
      where: {id:purchase.supplierId},
      data: {
        outstandingPayments: {
          increment:pendingAmount
        }
      }
    })

    // Check if stock already exists for this item in this branch
    const existingStock = await prisma.stock.findFirst({
      where: { 
        item: purchase.productType,
        branchId: result.data.branchId
      },
    });

    if (existingStock) {
      // Increment stock quantity for this branch
      await prisma.stock.update({
        where: { id: existingStock.id },
        data: {
          quantity: existingStock.quantity + purchase.quantity,
        },
      });
    } else {
      // Create new stock entry for this branch
      await prisma.stock.create({
        data: {
          item: purchase.productType,
          quantity: purchase.quantity,
          supplierId: purchase.supplierId,
          branchId: result.data.branchId,
        },
      });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'CREATE',
        module: 'Purchases',
        details: { id: purchase.id, amount: purchase.purchasePrice, supplierId: purchase.supplierId }
    });

    return NextResponse.json({ data: purchase }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
