import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authResult = await authenticateDevice(request);
  if (!authResult.success) {
    return authResult.response;
  }
  const device = authResult.device;

  try {
    const body = await request.json().catch(() => ({}));
    const status = body.status === "ERROR" ? "ERROR" : "SUCCESS";
    const error = body.error ? String(body.error) : null;
    const now = new Date();

    // 1. Update the specific authenticated device command state
    await prisma.device.update({
      where: { id: device.id },
      data: {
        syncRequested: false,
        syncStatus: status,
        syncError: error,
        lastHeartbeat: now,
        lastSeenAt: now
      }
    });

    // 2. Mirror status to SystemSettings for existing dashboard UI compatibility
    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: {
        syncRequested: false,
        syncStatus: status,
        syncError: error,
        lastHeartbeat: now,
        deviceOnline: true
      },
      create: {
        id: "singleton",
        syncRequested: false,
        syncStatus: status,
        syncError: error,
        lastHeartbeat: now,
        deviceOnline: true,
        adminPasswordHash: ""
      }
    });

    return NextResponse.json({
      success: true,
      deviceId: device.deviceId,
      syncStatus: status
    });
  } catch (err: any) {
    console.error("[DeviceCommandAckAPI] Error processing command ack:", err);
    return NextResponse.json(
      { error: "Internal server error processing command acknowledgement" },
      { status: 500 }
    );
  }
}
