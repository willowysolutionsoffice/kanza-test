import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { meterReadingUpdateSchema } from "@/schemas/meter-reading-schema";
import { ObjectId } from "mongodb";
import { updateBalanceReceiptIST } from "@/lib/ist-balance-utils";
import { getISTDateRangeForQuery } from "@/lib/date-utils";
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
    const body = await req.json();
    const parsed = meterReadingUpdateSchema.safeParse({ id, ...body });


    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id: _omitId, ...data } = parsed.data; void _omitId;

    // Get the existing meter reading row
    const existingReading = await prisma.meterReading.findUnique({
      where: { id },
      include: {
        nozzle: {
          include: {
            machine: {
              include: {
                machineTanks: { include: { tank: true } }
              }
            }
          }
        }
      }
    });

    if (!existingReading) {
      return NextResponse.json({ error: "Meter reading not found" }, { status: 404 });
    }

    // Calculate new difference if closing or opening reading changed
    const newOpeningReading = data.openingReading ?? existingReading.openingReading;
    const newClosingReading = data.closingReading ?? existingReading.closingReading;
    const newDifference = Number(
      (newClosingReading - newOpeningReading).toFixed(2)
    );

    // Calculate new sale and total amount if closing reading changed
    let newSale = existingReading.sale;
    let newTotalAmount = existingReading.totalAmount;
    
    if (data.closingReading !== undefined) {
      // Calculate new sale based on difference change
      const oldDiff = existingReading.closingReading - existingReading.openingReading;
      const saleChange = newDifference - oldDiff;
      newSale = Math.max(0, existingReading.sale + saleChange);
      
      // Calculate new total amount based on fuel rate
      const fuelRate = existingReading.fuelRate || 0;
      newTotalAmount = Math.round(newDifference * fuelRate);
    }

    // Prepare update data, only including fields that were provided
    const updateData: {
      nozzleId?: string;
      openingReading?: number;
      closingReading?: number;
      sale?: number;
      totalAmount?: number;
      date?: Date;
      difference: number;
    } = {
      difference: newDifference,
    };
    
    if (data.nozzleId !== undefined) updateData.nozzleId = data.nozzleId;
    if (data.openingReading !== undefined) updateData.openingReading = data.openingReading;
    if (data.closingReading !== undefined) {
      updateData.closingReading = data.closingReading;
      updateData.sale = newSale;
      updateData.totalAmount = newTotalAmount;
    }
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.date !== undefined) {
      // Preserve the time as 18:30:00.000+00:00 (6:30 PM UTC)
      const date = new Date(data.date);
      date.setUTCHours(18, 30, 0, 0); // Set to 18:30:00.000 UTC
      updateData.date = date;
    }

    // Check for duplicate if date or nozzleId is being updated
    if (data.date !== undefined || data.nozzleId !== undefined) {
      const finalNozzleId = data.nozzleId ?? existingReading.nozzleId;
      const finalDate = data.date !== undefined ? updateData.date : existingReading.date;
      
      if (finalDate) {
        // Create date range for the day
        const startOfDay = new Date(finalDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(finalDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        
        const duplicate = await prisma.meterReading.findFirst({
          where: {
            nozzleId: finalNozzleId,
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
            id: { not: id }, // Exclude current record
          },
        });

        if (duplicate) {
          return NextResponse.json(
            { error: `A meter reading already exists for this nozzle on ${finalDate.toLocaleDateString()}` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate changes for tank, stock, and nozzle updates
    const oldDiff = existingReading.closingReading - existingReading.openingReading;
    const newDiff = newDifference;
    const qtyChange = newDiff - oldDiff;

    // Get connected tank and fuel type
    const connectedTank = existingReading.nozzle?.machine?.machineTanks.find(
      (mt) => mt.tank?.fuelType === existingReading.nozzle?.fuelType
    )?.tank;

    const fuelType = existingReading.nozzle?.fuelType;

    // Execute all updates in a single transaction for atomicity
    const results = await prisma.$transaction(async (tx) => {
      // 1. Update the meter reading itself
      const updated = await tx.meterReading.update({
        where: { id },
        data: updateData,
      });

      // 2. Update nozzle opening reading
      if (data.closingReading !== undefined) {
        await tx.nozzle.update({
          where: { id: existingReading.nozzleId },
          data: { openingReading: newClosingReading },
        });
      }

      // 3. Update tank current level
      if (connectedTank && qtyChange !== 0) {
        await tx.tank.update({
          where: { id: connectedTank.id },
          data: {
            currentLevel:
              qtyChange > 0
                ? { decrement: qtyChange }
                : { increment: Math.abs(qtyChange) },
          },
        });
      }

      // 4. Update stock quantity
      if (fuelType && qtyChange !== 0 && existingReading.branchId) {
        await tx.stock.updateMany({
          where: { 
            item: fuelType,
            branchId: existingReading.branchId,
          },
          data: {
            quantity:
              qtyChange > 0
                ? { decrement: qtyChange }
                : { increment: Math.abs(qtyChange) },
          },
        });
      }

      // 5. Update Sale and BalanceReceipt ripple
      const amountDiff = newTotalAmount - existingReading.totalAmount;
      const oldDate = existingReading.date;
      const newDate = updateData.date || existingReading.date;

      if (existingReading.branchId && oldDate && newDate) {
        const isDateChanged = oldDate.toDateString() !== newDate.toDateString();

        // 5a. Update the Sale record (if it exists for the relevant date)
        const updateSaleForDate = async (targetDate: Date, delta: number) => {
          const dateString = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const { start, end } = getISTDateRangeForQuery(dateString);
          const sale = await tx.sale.findFirst({
            where: { branchId: existingReading.branchId, date: { gte: start, lte: end } }
          });
          if (sale) {
            await tx.sale.update({
              where: { id: sale.id },
              data: {
                rate: { increment: delta },
                cashPayment: { increment: delta }
              }
            });
          }
        };

        if (!isDateChanged) {
          // Same date → update balance by the difference
          if (amountDiff !== 0) {
            await updateSaleForDate(oldDate, amountDiff);
            await updateBalanceReceiptIST(existingReading.branchId, oldDate, amountDiff, tx);
          }
        } else {
          // Date changed → reverse from old, apply to new
          // Subtract old amount from old date
          await updateSaleForDate(oldDate, -existingReading.totalAmount);
          await updateBalanceReceiptIST(existingReading.branchId, oldDate, -existingReading.totalAmount, tx);
          
          // Add new amount to new date
          await updateSaleForDate(newDate, newTotalAmount);
          await updateBalanceReceiptIST(existingReading.branchId, newDate, newTotalAmount, tx);
        }
      }

      return updated;
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'UPDATE',
      module: 'MeterReadings',
      details: { id, changes: updateData }
    });

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (error) {
    console.error("Error updating meter reading:", error);
    
    // Handle unique constraint error
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return NextResponse.json(
        { error: "A meter reading already exists for this nozzle on the selected date" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Get the meter reading with related data BEFORE deleting
    const existingReading = await prisma.meterReading.findUnique({
      where: { id },
      include: {
        nozzle: {
          include: {
            machine: {
              include: {
                machineTanks: { include: { tank: true } }
              }
            }
          }
        }
      }
    });

    if (!existingReading) {
      return NextResponse.json({ error: "Meter reading not found" }, { status: 404 });
    }

    // Calculate the difference to restore
    const difference = existingReading.closingReading - existingReading.openingReading;
    const fuelType = existingReading.fuelType;
    const branchId = existingReading.branchId;

    // Get connected tank
    const connectedTank = existingReading.nozzle?.machine?.machineTanks.find(
      (mt) => mt.tank?.fuelType === fuelType
    )?.tank;

    // Execute all operations in a transaction
    const results = await prisma.$transaction(async (tx) => {
      // 1. Delete the meter reading
      const removed = await tx.meterReading.delete({
        where: { id },
      });

      // 2. Restore tank current level
      if (connectedTank && difference > 0) {
        await tx.tank.update({
          where: { id: connectedTank.id },
          data: {
            currentLevel: { increment: difference },
          },
        });
      }

      // 3. Restore stock quantity
      if (fuelType && branchId && difference > 0) {
        await tx.stock.updateMany({
          where: {
            item: fuelType,
            branchId: branchId,
          },
          data: {
            quantity: { increment: difference },
          },
        });
      }

      // 4. Adjust Sale and ripple BalanceReceipt back
      if (existingReading.totalAmount > 0 && branchId && existingReading.date) {
        const dateString = existingReading.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const { start, end } = getISTDateRangeForQuery(dateString);

        const existingSale = await tx.sale.findFirst({
          where: {
            branchId: branchId,
            date: { gte: start, lte: end }
          }
        });

        if (existingSale) {
          await tx.sale.update({
            where: { id: existingSale.id },
            data: {
              rate: { decrement: existingReading.totalAmount },
              cashPayment: { decrement: existingReading.totalAmount }
            }
          });
        }

        // Ripple the negative correction forward
        await updateBalanceReceiptIST(
          branchId,
          existingReading.date,
          -existingReading.totalAmount,
          tx
        );
      }

      return removed;
    });

    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'DELETE',
      module: 'MeterReadings',
      details: { id, deletedData: existingReading }
    });

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (error) {
    console.error("Error deleting meter reading:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
