import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { salesSchema } from "@/schemas/sales-schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { updateBalanceReceiptIST } from "@/lib/ist-balance-utils";
import { createLog } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Transform empty strings to null for nullable payment fields
    const transformedBody = {
      ...body,
      atmPayment: body.atmPayment === "" ? null : body.atmPayment,
      paytmPayment: body.paytmPayment === "" ? null : body.paytmPayment,
      fleetPayment: body.fleetPayment === "" ? null : body.fleetPayment,
    };

    // ✅ Validate with Zod
    const result = salesSchema.safeParse(transformedBody);
    if (!result.success) {
      console.error("Validation failed:", result.error.flatten().fieldErrors);
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

    // ✅ Validate date is not present or future (only allow past dates)
    const { getCurrentDateIST } = await import("@/lib/date-utils");
    const currentDate = getCurrentDateIST();
    const inputDate = result.data.date;
    // Compare dates (ignore time)
    const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    console.log("📅 Date validation:", {
      inputDate: inputDateOnly.toISOString(),
      currentDate: currentDateOnly.toISOString(),
      isFuture: inputDateOnly >= currentDateOnly
    });
    
    if (inputDateOnly >= currentDateOnly) {
      console.error("❌ Date validation failed: Future date not allowed");
      return NextResponse.json(
        { error: "Cannot store sale for present or future dates. Only past dates are allowed." },
        { status: 400 }
      );
    }

    // ✅ Check if sale already exists for the same date and branch
    const existingSale = await prisma.sale.findFirst({
      where: {
        branchId,
        date: {
          gte: new Date(result.data.date.getFullYear(), result.data.date.getMonth(), result.data.date.getDate()),
          lt: new Date(result.data.date.getFullYear(), result.data.date.getMonth(), result.data.date.getDate() + 1),
        },
      },
    });

    if (existingSale) {
      return NextResponse.json(
        { error: "A sale already exists for this date." },
        { status: 400 }
      );
    }

    // ✅ Create Sale and update balance receipt in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Prepare data for Prisma, ensuring branchId is properly typed and empty strings become null
      const saleData: {
        date: Date;
        cashPayment: number;
        atmPayment?: number | null;
        paytmPayment?: number | null;
        fleetPayment?: number | null;
        products: Record<string, number>;
        rate: number;
        xgDieselTotal?: number | null;
        hsdDieselTotal?: number | null;
        msPetrolTotal?: number | null;
        powerPetrolTotal?: number | null;
        fuelTotals?: Record<string, number>;
        branchId?: string;
      } = {
        ...result.data,
        atmPayment: result.data.atmPayment === "" ? null : (result.data.atmPayment ?? null),
        paytmPayment: result.data.paytmPayment === "" ? null : (result.data.paytmPayment ?? null),
        fleetPayment: result.data.fleetPayment === "" ? null : (result.data.fleetPayment ?? null),
        branchId: branchId || undefined,
      };

      // Create sale
      const newSale = await tx.sale.create({
        data: saleData as Prisma.SaleCreateInput,
      });

      // Update balance receipt with cash payment (positive amount = cash received)
      // Note: Only cash payments affect the cash balance, non-cash payments don't
      if (branchId) {
        await updateBalanceReceiptIST(
          branchId,
          result.data.date,
          newSale.cashPayment,
          tx,
          { carryForwardOnExisting: true }
        );
      }

      return newSale;
    });

    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'CREATE',
      module: 'Sales',
      details: { id: sale.id, date: sale.date, cashPayment: sale.cashPayment }
    });

    revalidatePath("/sales");
    return NextResponse.json({ data: sale }, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
