import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authResult = await authenticateDevice(request);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const status = body.status === "ERROR" ? "ERROR" : "SUCCESS";
    const error = body.error ? String(body.error) : null;

    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: {
        syncRequested: false,
        syncStatus: status,
        syncError: error,
        lastHeartbeat: new Date(),
        deviceOnline: true
      },
      create: {
        id: "singleton",
        syncRequested: false,
        syncStatus: status,
        syncError: error,
        lastHeartbeat: new Date(),
        deviceOnline: true,
        adminPasswordHash: ""
      }
    });

    return NextResponse.json({
      success: true
    });
  } catch (err: any) {
    console.error("[DeviceCommandAckAPI] Error processing command ack:", err);
    return NextResponse.json(
      { error: "Internal server error processing command acknowledgement" },
      { status: 500 }
    );
  }
}
