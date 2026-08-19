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
    let body: any = {};
    try {
      body = await request.json();
    } catch (_) {}

    const deviceReachable = typeof body.deviceReachable === "boolean" ? body.deviceReachable : true;
    const deviceIp = typeof body.deviceIp === "string" ? body.deviceIp.trim() : null;

    const now = new Date();

    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastHeartbeat: now,
        lastSeenAt: now,
        deviceIp: deviceIp || undefined
      }
    });

    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: {
        lastHeartbeat: now,
        deviceOnline: deviceReachable
      },
      create: {
        id: "singleton",
        lastHeartbeat: now,
        deviceOnline: deviceReachable,
        adminPasswordHash: ""
      }
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      device: {
        deviceId: device.deviceId,
        isActive: device.isActive
      }
    });
  } catch (err: any) {
    console.error("[DeviceHeartbeatAPI] Error processing heartbeat:", err);
    return NextResponse.json(
      { error: "Internal server error processing heartbeat" },
      { status: 500 }
    );
  }
}
