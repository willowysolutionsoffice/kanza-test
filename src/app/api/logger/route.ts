import { NextRequest, NextResponse } from "next/server";
import { logToFile, cleanLogFile, getLogs } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, type, source } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    await logToFile(message, type, source);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to log" }, { status: 500 });
  }
}

export async function DELETE() {
    const success = await cleanLogFile();
    if (success) {
        return NextResponse.json({ success: true, message: "Logs cleaned" });
    } else {
        return NextResponse.json({ success: false, error: "Failed to clean logs" }, { status: 500 });
    }
}

export async function GET() {
    const logs = await getLogs();
    return new NextResponse(logs, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}
