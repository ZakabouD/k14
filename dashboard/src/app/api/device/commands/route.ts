import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authResult = await authenticateDevice(request);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const settings = await prisma.systemSettings.findFirst({
      select: { syncRequested: true, syncStatus: true }
    });

    return NextResponse.json({
      syncRequested: !!settings?.syncRequested,
      syncStatus: settings?.syncStatus || "IDLE"
    });
  } catch (err: any) {
    console.error("[DeviceCommandsAPI] Error fetching commands:", err);
    return NextResponse.json(
      { error: "Internal server error fetching commands" },
      { status: 500 }
    );
  }
}
