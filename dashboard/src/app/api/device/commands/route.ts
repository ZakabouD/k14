import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authResult = await authenticateDevice(request);
  if (!authResult.success) {
    return authResult.response;
  }
  const authenticatedDevice = authResult.device;

  try {
    // Read command state directly from the authenticated device record
    const device = await prisma.device.findUnique({
      where: { id: authenticatedDevice.id },
      select: { syncRequested: true, syncStatus: true, syncError: true }
    });

    // Fallback/mirror check on SystemSettings for backward compatibility
    const settings = await prisma.systemSettings.findFirst({
      select: { syncRequested: true }
    });

    const isSyncRequested = !!device?.syncRequested || !!settings?.syncRequested;

    return NextResponse.json({
      syncRequested: isSyncRequested,
      syncStatus: device?.syncStatus || "IDLE"
    });
  } catch (err: any) {
    console.error("[DeviceCommandsAPI] Error fetching device commands:", err);
    return NextResponse.json(
      { error: "Internal server error fetching commands" },
      { status: 500 }
    );
  }
}
