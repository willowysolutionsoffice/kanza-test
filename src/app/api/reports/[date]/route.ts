// app/api/report/[date]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import moment from "moment-timezone";
import { getISTDateRangeForQuery } from "@/lib/date-utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    
    // Use IST timezone for consistent date handling
    const { start: startOfDay, end: endOfDay } = getISTDateRangeForQuery(date);

    // Purchase
    const purchases = await prisma.purchase.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
    });
    const totalPurchase = purchases.reduce(
      (sum, p) => sum + (p.purchasePrice || 0),
      0
    );

    // Sale
    const sales = await prisma.sale.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
      include: {
        branch: {
          select: {
            name: true
          }
        }
      }
    });
    const totalSale = sales.reduce(
      (sum, s) =>
        sum +
        (s.rate || 0),
      0
    );

    const atmTotal = sales.reduce(
      (sum, s) =>
        sum +
        (s.atmPayment || 0),
      0
    );

    const paytmTotal = sales.reduce(
      (sum, s) =>
        sum +
        (s.paytmPayment || 0),
      0
    );

    const fleetTotal = sales.reduce(
      (sum, s) =>
        sum +
        (s.fleetPayment || 0),
      0
    );

    // Expense
    const expenses = await prisma.expense.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
      include: {
        category: true,
      },
    });


    // Expense = actual expenses - (non-cash payments)
    const totalExpense = expenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0
    );

    
        

    // Credit
    const credits = await prisma.credit.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
      include:{customer:true},
    });
    const totalCredit = credits.reduce(
      (sum, c) => sum + (c.amount || 0),
      0
    );

    // Meter Readings
    const meterReadings = await prisma.meterReading.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
      include: { nozzle: true, machine: true },
    });

    const oils = await prisma.oil.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
    });

    const bankDeposite = await prisma.bankDeposite.findMany({
      where: { 
        date: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
      include: {bank:true}
    });

    const bankDepositTotal = bankDeposite.reduce(
        (sum,b) => sum + (b.amount || 0),0
    )

    // Customer Payments
    const customerPayments = await prisma.customerPayment.findMany({
      where: { 
        paidOn: { gte: startOfDay, lte: endOfDay },
        ...(branchId && { branchId })
      },
      include: {
        customer: true
      }
    });

    const totalCustomerPayment = customerPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    // Get yesterday's BalanceReceipt using IST timezone
    const yesterday = moment.tz(date, "Asia/Kolkata").subtract(1, "day").format("YYYY-MM-DD");
    const { start: yesterdayStart, end: yesterdayEnd } = getISTDateRangeForQuery(yesterday);

    const yesterdayReceipts = await prisma.balanceReceipt.findMany({
      where: {
        date: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
        ...(branchId && { branchId })
      },
    });

    const totalBalanceReceipt = yesterdayReceipts.reduce(
      (sum, r) => sum + (r.amount || 0),
      0
    );

    const salesAndExpense = totalSale - totalExpense - totalCredit

    const salesAndBalaceReceipt = totalSale + totalBalanceReceipt + totalCustomerPayment

    const expenseSum = totalExpense + totalCredit + paytmTotal + atmTotal + fleetTotal;

    const cashBalance = salesAndBalaceReceipt - expenseSum - bankDepositTotal;

    // Get branch name
    let branchName = "COCO KONDOTTY"; // default
    if (branchId) {
      // If branchId is provided, fetch the branch name
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { name: true }
      });
      branchName = branch?.name || "COCO KONDOTTY";
    } else if (sales.length > 0 && sales[0].branch?.name) {
      // Fallback to first sale's branch name
      branchName = sales[0].branch.name;
    }

    return NextResponse.json({
      date,
      branchName,
      totals: {
        totalPurchase,
        totalSale,
        totalExpense,
        totalCredit,
        salesAndExpense,
        totalBalanceReceipt,
        salesAndBalaceReceipt,
        expenseSum,
        cashBalance,
      },
      purchases,
      sales,
      expenses,
      credits,
      oils,
      bankDeposite,
      meterReadings,
      customerPayments,
    });
  } catch (err) {
    console.error("Report fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    // Use IST timezone for consistent date handling
    const { start: startOfDay, end: endOfDay } = getISTDateRangeForQuery(date);

    // Common where clause for models that use 'date' and 'branchId'
    const whereClause = {
      date: { gte: startOfDay, lte: endOfDay },
      branchId: branchId,
    };

    // We need to delete from all related models in a transaction
    await prisma.$transaction([
      prisma.sale.deleteMany({ where: whereClause }),
      prisma.credit.deleteMany({ where: whereClause }),
      prisma.customerPayment.deleteMany({
        where: {
          paidOn: { gte: startOfDay, lte: endOfDay },
          branchId: branchId,
        },
      }),
      prisma.purchase.deleteMany({ where: whereClause }),
      prisma.expense.deleteMany({ where: whereClause }),
      prisma.meterReading.deleteMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          branchId: branchId,
        },
      }),
      prisma.oil.deleteMany({ where: whereClause }),
      prisma.bankDeposite.deleteMany({ where: whereClause }),
      prisma.balanceReceipt.deleteMany({ where: whereClause }),
    ]);

    return NextResponse.json({ message: "Daily report and all related records deleted successfully" });
  } catch (err) {
    console.error("Report delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete daily report" },
      { status: 500 }
    );
  }
}
