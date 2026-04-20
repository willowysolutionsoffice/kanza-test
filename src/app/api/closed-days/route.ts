import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// GET /api/closed-days?branchId=xxx&date=yyyy-mm-dd
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId =
      searchParams.get("branchId") || session.user.branch || undefined;
    const dateParam = searchParams.get("date");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (branchId) where.branchId = branchId;

    if (dateParam) {
      const d = new Date(dateParam);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.date = { gte: start, lt: end };
    }

    const closedDays = await prisma.closedDay.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ data: closedDays }, { status: 200 });
  } catch (error) {
    console.error("Error fetching closed days:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/closed-days
// Body: { date: string, branchId?: string, reason?: string }
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { date, reason } = body;
    const branchId = body.branchId || session.user.branch;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Normalise to midnight UTC so the unique constraint works cleanly
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    // Upsert — if it already exists, just return it (idempotent)
    const closedDay = await prisma.closedDay.upsert({
      where: {
        date_branchId: {
          date: d,
          branchId,
        },
      },
      update: { reason: reason ?? null },
      create: {
        date: d,
        branchId,
        reason: reason ?? null,
      },
    });

    return NextResponse.json({ data: closedDay }, { status: 201 });
  } catch (error) {
    console.error("Error creating closed day:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/closed-days?date=yyyy-mm-dd&branchId=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const branchId =
      searchParams.get("branchId") || session.user.branch || undefined;

    if (!dateParam || !branchId) {
      return NextResponse.json(
        { error: "date and branchId are required" },
        { status: 400 }
      );
    }

    const d = new Date(dateParam);
    d.setUTCHours(0, 0, 0, 0);

    await prisma.closedDay.deleteMany({
      where: {
        date: {
          gte: d,
          lt: new Date(d.getTime() + 86400000),
        },
        branchId,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting closed day:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
