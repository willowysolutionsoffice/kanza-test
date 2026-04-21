import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { createLog } from "@/lib/logger";

// NEW: schema for batch meter readings
const batchMeterReadingSchema = z.object({
  date: z.string(), // date of readings
  shift: z.string(),
  machines: z.array(
    z.object({
      machineId: z.string(),
      nozzles: z.array(
        z.object({
          nozzleId: z.string(),
          fuelType: z.string(),
          openingReading: z.number(),
          closingReading: z.number(),
          sale:z.number(),
        })
      ),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = batchMeterReadingSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });
    
    // Get branchId from request body if provided (for admin), otherwise use session branch
    const branchId = body.branchId || session?.user?.branch;
    
    // Validate that branchId is set
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required. Please select a branch." },
        { status: 400 }
      );
    }

    // Preserve the time as 18:30:00.000+00:00 (6:30 PM UTC)
    const readingDate = new Date(result.data.date);
    readingDate.setUTCHours(18, 30, 0, 0); // Set to 18:30:00.000 UTC

    // ✅ Check for duplicate readings per nozzle per date (not per branch)
    // Multiple nozzles can have readings on the same date, but same nozzle cannot have duplicate readings
    for (const machine of result.data.machines) {
      for (const nozzle of machine.nozzles) {
        const existingReading = await prisma.meterReading.findFirst({
          where: {
            nozzleId: nozzle.nozzleId,
            branchId,
            date: {
              gte: new Date(readingDate.getFullYear(), readingDate.getMonth(), readingDate.getDate()),
              lt: new Date(readingDate.getFullYear(), readingDate.getMonth(), readingDate.getDate() + 1),
            },
          },
        });

        if (existingReading) {
          return NextResponse.json(
            { error: `A meter reading already exists for nozzle ${nozzle.nozzleId} on this date.` },
            { status: 400 }
          );
        }
      }
    }

    // ✅ Validate date is not present or future (only allow past dates)
    const { getCurrentDateIST } = await import("@/lib/date-utils");
    const currentDate = getCurrentDateIST();
    const inputDate = new Date(result.data.date);
    // Compare dates (ignore time)
    const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    if (inputDateOnly >= currentDateOnly) {
      return NextResponse.json(
        { error: "Cannot store meter reading for present or future dates. Only past dates are allowed." },
        { status: 400 }
      );
    }

    const createdReadings = [];

    for (const machine of result.data.machines) {
      for (const nozzle of machine.nozzles) {
        const difference = nozzle.closingReading - nozzle.openingReading;

        // store opening reading
        const opening = await prisma.meterReading.create({
          data: {
            nozzleId: nozzle.nozzleId,
            branchId,
            fuelType: nozzle.fuelType,
            openingReading: nozzle.openingReading,
            closingReading:nozzle.closingReading,
            date: readingDate,
            sale:nozzle.sale,
            difference: null,
            totalAmount:0,
          },
        });

        // store closing reading
        const closing = await prisma.meterReading.create({
          data: {
            nozzleId: nozzle.nozzleId,
            branchId,
            fuelType: nozzle.fuelType,
            openingReading:nozzle.openingReading,
            closingReading: nozzle.closingReading,
            date: readingDate,
            sale:nozzle.sale,
            difference,
            totalAmount:0,
          },
        });

        createdReadings.push(opening, closing);

        // adjust tank stock (for closing reading only)
        const nozzleWithTank = await prisma.nozzle.findUnique({
          where: { id: nozzle.nozzleId },
          include: {
            machine: {
              include: {
                machineTanks: {
                  include: { tank: true },
                },
              },
            },
          },
        });

        if (nozzleWithTank) {
          const connectedTank = nozzleWithTank.machine?.machineTanks.find(
            (mt) => mt.tank?.fuelType === nozzleWithTank.fuelType
          )?.tank;

          if (connectedTank) {
            // Check if tank level is sufficient
            if (connectedTank.currentLevel - difference < 0) {
              throw new Error(`Tank "${connectedTank.tankName}" does not have sufficient current level. Available: ${connectedTank.currentLevel.toFixed(2)}L, Required: ${difference.toFixed(2)}L`); 
            }

            // Check if stock is sufficient for the specific branch
            const stock = await prisma.stock.findFirst({
              where: {
                item: nozzle.fuelType,
                branchId: branchId, // CRITICAL: Check stock for this branch only
              },
            });

            if (!stock) {
              throw new Error(`Stock not found for ${nozzle.fuelType} in this branch`);
            }

            if (stock.quantity - difference < 0) {
              throw new Error(`No stock available for ${nozzle.fuelType}. Available: ${stock.quantity.toFixed(2)}L, Required: ${difference.toFixed(2)}L`);
            }
            
            // ✅ Safe to decrement tank
              await prisma.tank.update({
                where: { id: connectedTank.id },
                data: {
                  currentLevel: {
                    decrement: difference,
                  },
                },
              });
            
            // ✅ Update stock for the specific branch only
            const updateResult = await prisma.stock.updateMany({
              where: {
                item: nozzle.fuelType,
                branchId: branchId, // CRITICAL: Only update stock for this branch
              },
              data: {
                quantity: {
                  decrement: difference,
                },
              },
            });

            // Verify that exactly one stock record was updated
            if (updateResult.count === 0) {
              throw new Error(`No stock record found for ${nozzle.fuelType} in branch ${branchId}`);
            } else if (updateResult.count > 1) {
              throw new Error(`Multiple stock records found for ${nozzle.fuelType} in branch ${branchId}`);
            }

            // Double-check stock didn't go negative (safety check)
            const updatedStock = await prisma.stock.findFirst({
              where: {
                item: nozzle.fuelType,
                branchId: branchId,
              },
            });

            if (updatedStock && updatedStock.quantity < 0) {
              // Rollback: restore the stock
              await prisma.stock.updateMany({
                where: {
                  item: nozzle.fuelType,
                  branchId: branchId,
                },
                data: {
                  quantity: { increment: difference },
                },
              });
              throw new Error(`Stock would go negative for ${nozzle.fuelType}. Operation cancelled.`);
            }

            console.log(`Updated stock ${nozzle.fuelType} by ${difference} for branch ${branchId}`);
          }
        }
      }
    }

    await createLog({
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      action: 'CREATE',
      module: 'MeterReadings',
      details: { count: createdReadings.length, date: result.data.date, shift: result.data.shift }
    });

    revalidatePath("/meter-reading");

    return NextResponse.json({ data: createdReadings }, { status: 201 });
  } catch (error) {
    console.error("Error creating batch Meter Readings:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
