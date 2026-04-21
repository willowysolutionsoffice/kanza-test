import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refillTankSchema } from "@/schemas/refill-schema";
import { revalidatePath } from "next/cache";
import { createLog } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ✅ Zod validation
    const result = refillTankSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tankId, refillAmount, ...rest } = result.data;

    const [refill] = await prisma.$transaction([
      prisma.refill.create({
        data: {
          tankId,
          refillAmount,
          ...rest,
        },
      }),
      prisma.tank.update({
        where: { id: tankId },
        data: {
          currentLevel: {
            increment: refillAmount,
          },
          lastFilled:new Date()
        },
      }),
    ]);
    
    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'CREATE',
        module: 'Refills',
        details: { tankId, refillAmount }
    });

    revalidatePath("/tanks");
    return NextResponse.json({ data: refill }, { status: 201 });
  } catch (error) {
    console.error("Error creating refill:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
