import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getISTDateRangeForQuery } from "@/lib/date-utils";

/**
 * IST-aware balance receipt utilities
 * Handles dates in IST timezone consistently
 */
type BalanceReceiptOptions = {
  /**
   * When true, add yesterday's balance even if a balance receipt
   * already exists for the date (used when sales are saved after
   * other adjustments like expenses or deposits).
   */
  carryForwardOnExisting?: boolean;
};

export async function updateBalanceReceiptIST(
  branchId: string,
  date: Date,
  amountChange: number,
  tx?: Prisma.TransactionClient,
  options?: BalanceReceiptOptions
) {
  const prismaClient = tx || prisma;
  const { carryForwardOnExisting = false } = options || {};
  
  // Convert the date to IST date string using the same logic as report modal
  const dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { start, end } = getISTDateRangeForQuery(dateString);
  
  // Check if balance receipt exists for this date and branch
  const existingReceipt = await prismaClient.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  if (existingReceipt) {
    // For sales, we need to add yesterday's balance + cash payment to existing receipt
    if (amountChange > 0) {
      // This is a sale - optionally add yesterday's balance before incrementing
      
      const previousBalance = carryForwardOnExisting
        ? await getPreviousDayBalanceIST(branchId, date, prismaClient)
        : 0;

      let dataUpdate;
      let propagationDelta = amountChange;
      
      if (previousBalance > 0) {
        // Carry forward logic: Absolute set including previous balance
        // Note: This specific case is not fully atomic regarding 'amount', 
        // but solves the "Missing Base" problem.
        dataUpdate = { amount: existingReceipt.amount + previousBalance + amountChange };
        propagationDelta = previousBalance + amountChange;
      } else {
        // Pure increment - Atomic and Safe
        dataUpdate = { amount: { increment: amountChange } };
        // propagationDelta remains amountChange
      }
      
      const result = await prismaClient.balanceReceipt.update({
        where: { id: existingReceipt.id },
        data: dataUpdate,
      });
      
      // Propagate the effective change to future dates
      await propagateBalanceCorrection(branchId, date, propagationDelta, prismaClient);
      
      return result;
    } else {
      // Normal update for expenses/credits/bank-deposits
      // Use atomic increment (negative amountChange)
      const result = await prismaClient.balanceReceipt.update({
        where: { id: existingReceipt.id },
        data: {
          amount: { increment: amountChange },
        },
      });
      
      // Propagate change
      await propagateBalanceCorrection(branchId, date, amountChange, prismaClient);
      
      return result;
    }
  } else {
    // Create new receipt
    const previousBalance = await getPreviousDayBalanceIST(branchId, date, prismaClient);
    
    // Create IST date for storage
    const [year, month, day] = dateString.split('-').map(Number);
    const previousDay = new Date(year, month - 1, day - 1);
    const istDate = new Date(`${previousDay.getFullYear()}-${String(previousDay.getMonth() + 1).padStart(2, '0')}-${String(previousDay.getDate()).padStart(2, '0')}T18:30:00.000Z`);
    
    // Determine the new balance amount
    let newAmount: number;
    if (amountChange < 0) {
      // For expenses/credits/bank-deposits (negative amountChange)
      // If no previous balance receipt exists, start with 0 + amount
      newAmount = 0 + amountChange; 
    } else {
      // For sales (positive amountChange)
      newAmount = previousBalance + amountChange;
    }
    
    const result = await prismaClient.balanceReceipt.create({
      data: {
        date: istDate, 
        amount: newAmount,
        branchId,
      },
    });
    
    // Propagate the Gap Filling. 
    // The previous effective balance for this missing day was '0' (or undefined).
    // Now it is 'newAmount'. So the Delta experienced by future days is 'newAmount'.
    await propagateBalanceCorrection(branchId, date, newAmount, prismaClient);
    
    return result;
  }
}

/**
 * Get previous day's balance for carry forward (IST timezone)
 */
async function getPreviousDayBalanceIST(branchId: string, currentDate: Date, prismaClient: any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const previousDay = new Date(currentDate);
  previousDay.setDate(previousDay.getDate() - 1);
  
  // Convert the previous day to IST date string using the same logic as report modal
  const previousDateString = previousDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { start, end } = getISTDateRangeForQuery(previousDateString);
  
  const previousReceipt = await prismaClient.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { date: 'desc' },
  });
  
  return previousReceipt?.amount || 0;
}

/**
 * Get current cash balance for a branch on a specific date (IST timezone)
 */
export async function getCurrentBalanceIST(branchId: string, date: Date): Promise<number> {
  // Convert the date to IST date string using the same logic as report modal
  const dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { start, end } = getISTDateRangeForQuery(dateString);
  
  const receipt = await prisma.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { date: 'desc' },
  });
  
  return receipt?.amount || 0;
}

/**
 * Get balance receipt for a specific date and branch (IST timezone)
 */
export async function getBalanceReceiptIST(branchId: string, date: Date) {
  // Convert the date to IST date string using the same logic as report modal
  const dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { start, end } = getISTDateRangeForQuery(dateString);
  
  return await prisma.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: start,
        lte: end,
      },
    },
  });
}

/**
 * Update balance receipt for payments (IST timezone)
 * For payments: only add payment amount, don't add yesterday's balance
 */
export async function updateBalanceReceiptForPaymentIST(
  branchId: string,
  date: Date,
  amountChange: number,
  tx?: Prisma.TransactionClient
) {
  const prismaClient = tx || prisma;
  
  const dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { start, end } = getISTDateRangeForQuery(dateString);
  
  // Check if balance receipt exists for this date and branch
  const existingReceipt = await prismaClient.balanceReceipt.findFirst({
    where: {
      branchId,
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  if (existingReceipt) {
    // Update existing receipt with payment amount using atomic increment
    const result = await prismaClient.balanceReceipt.update({
      where: { id: existingReceipt.id },
      data: {
        amount: { increment: amountChange },
      },
    });
    
    await propagateBalanceCorrection(branchId, date, amountChange, prismaClient);
    return result;
  } else {
    // Create new receipt with only the payment amount (no yesterday's balance)
    const [year, month, day] = dateString.split('-').map(Number);
    const previousDay = new Date(year, month - 1, day - 1);
    const istDate = new Date(`${previousDay.getFullYear()}-${String(previousDay.getMonth() + 1).padStart(2, '0')}-${String(previousDay.getDate()).padStart(2, '0')}T18:30:00.000Z`);
    
    const result = await prismaClient.balanceReceipt.create({
      data: {
        date: istDate, // Store in IST format (18:30:00.000Z)
        amount: amountChange, // Only the payment amount, no previous balance
        branchId,
      },
    });
    
    // Propagate the new amount as the delta causing "creation" of balance
    await propagateBalanceCorrection(branchId, date, amountChange, prismaClient);
    return result;
  }
}

/**
 * Propagates a balance change to all future dates (Broken Chain Fix)
 * If a transaction is added/edited in the past, this ensures the change
 * ripples forward to all subsequent balance receipts.
 */
export async function propagateBalanceCorrection(
  branchId: string,
  transactionDate: Date,
  amountChange: number,
  tx?: Prisma.TransactionClient
) {
  const prismaClient = tx || prisma;

  // 1. Get the IST date boundaries for the transaction date
  const dateString = transactionDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { end } = getISTDateRangeForQuery(dateString);

  // 2. Find all receipts strictly AFTER this date
  // We use updateMany for efficiency and atomicity.
  await prismaClient.balanceReceipt.updateMany({
    where: {
      branchId,
      date: {
        gt: end, // Strictly greater than the transaction day's end
      },
    },
    data: {
      amount: {
        increment: amountChange,
      },
    },
  });
}
