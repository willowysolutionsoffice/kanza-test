import { prisma } from "@/lib/prisma";

/**
 * Updates the balance receipt for a given date and branch
 * This is the central function that handles all balance receipt updates
 */
export async function updateBalanceReceipt(
  branchId: string,
  date: Date,
  amountChange: number,
  tx?: any // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const prismaClient = tx || prisma;
  
  // Normalize date to start of day for consistent lookups
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  // Check if balance receipt exists for this date and branch
  const existingReceipt = await prismaClient.balanceReceipt.findFirst({
    where: {
      branchId,
      date: normalizedDate,
    },
  });

  if (existingReceipt) {
    // Update existing receipt atomically
    const result = await prismaClient.balanceReceipt.update({
      where: { id: existingReceipt.id },
      data: {
        amount: { increment: amountChange },
      },
    });
    return result;
  } else {
    // Create new receipt with previous balance + current change
    const previousBalance = await getPreviousDayBalance(branchId, normalizedDate, prismaClient);
    const result = await prismaClient.balanceReceipt.create({
      data: {
        date: normalizedDate,
        amount: previousBalance + amountChange,
        branchId,
      },
    });
    return result;
  }
}

/**
 * Get previous day's balance for carry forward
 */
async function getPreviousDayBalance(branchId: string, currentDate: Date, prismaClient: any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const previousDay = new Date(currentDate);
  previousDay.setDate(previousDay.getDate() - 1);
  
  const previousReceipt = await prismaClient.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: previousDay,
        lt: new Date(previousDay.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { date: 'desc' },
  });
  
  return previousReceipt?.amount || 0;
}

/**
 * Get current cash balance for a branch on a specific date
 */
export async function getCurrentBalance(branchId: string, date: Date): Promise<number> {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  const receipt = await prisma.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: normalizedDate,
        lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { date: 'desc' },
  });
  
  return receipt?.amount || 0;
}

/**
 * Get balance receipt for a specific date and branch
 */
export async function getBalanceReceipt(branchId: string, date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  return await prisma.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: normalizedDate,
        lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
}
