import { NextRequest, NextResponse } from "next/server";
import { tankSchema } from "@/schemas/tank-schema";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createLog } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

//create new tank

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = tankSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }   
    


    const tank = await prisma.tank.create({
      data: {
        ...result.data,
      },
    });
    
    const session = await auth.api.getSession({ headers: await headers() });
    await createLog({
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        action: 'CREATE',
        module: 'Tanks',
        details: { id: tank.id, name: tank.tankName, capacity: tank.capacity }
    });

    revalidatePath("/tanks");

    return NextResponse.json({ data: tank }, { status: 201 });
  } catch (error) {
    console.error("Error creating tank:", error);
    
    // Check if it's a unique constraint violation (duplicate tank name)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const target = error.meta?.target as string[] | undefined;
        if (target && target.includes('tankName')) {
          return NextResponse.json(
            { error: `A tank with the name "${(error.meta?.targetValue as string) || 'this name'}" already exists. Please choose a different name.` },
            { status: 400 }
          );
        }
      }
    }
    
    // Check for MongoDB duplicate key error
    if (error instanceof Error && (error.message.includes('E11000') || error.message.includes('duplicate'))) {
      return NextResponse.json(
        { error: `A tank with this name already exists in other branch.` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
