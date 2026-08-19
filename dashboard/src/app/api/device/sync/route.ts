import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { serverCalculationService } from "@/lib/server-calculation";

const MAX_BATCH_SIZE = 5000;

export async function POST(request: NextRequest) {
  // 1. Authenticate hardware device
  const authResult = await authenticateDevice(request);
  if (!authResult.success) {
    return authResult.response;
  }
  const device = authResult.device;

  try {
    const body = await request.json();
    const records = body.records || [];
    const users = body.users || [];
    const deviceIp = body.deviceIp || null;

    if (!Array.isArray(records)) {
      return NextResponse.json(
        { error: "Invalid payload: 'records' must be an array" },
        { status: 400 }
      );
    }

    if (records.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Payload too large: maximum batch size is ${MAX_BATCH_SIZE} records` },
        { status: 413 }
      );
    }

    // 2. Synchronize device users (Non-destructive: NEVER overwrites HR-managed fields)
    if (Array.isArray(users) && users.length > 0) {
      for (const u of users) {
        const rawUserId = String(u.userId || u.user_id || "").trim();
        if (!rawUserId) continue;

        const rawName = String(u.name || "").trim();
        let firstName = "Employé";
        let lastName = rawUserId;

        if (rawName.length > 0) {
          const parts = rawName.split(" ");
          if (parts.length > 1) {
            firstName = parts[0]!;
            lastName = parts.slice(1).join(" ");
          } else {
            firstName = rawName;
            lastName = rawName;
          }
        }

        // Upsert strictly touches name fields if updating; never modifies HR fields
        await prisma.user.upsert({
          where: { zktecoUserId: rawUserId },
          update: rawName.length > 0 ? { firstName, lastName } : {},
          create: {
            zktecoUserId: rawUserId,
            firstName,
            lastName,
            isActive: true
          }
        });
      }
    }

    // Ensure all punch users have at least a baseline employee record
    const uniqueUserIds = [...new Set(records.map((r: any) => String(r.zktecoUserId || r.user_id || "").trim()))].filter(Boolean);
    for (const uid of uniqueUserIds) {
      const existing = await prisma.user.findUnique({
        where: { zktecoUserId: uid },
        select: { id: true }
      });
      if (!existing) {
        await prisma.user.create({
          data: {
            zktecoUserId: uid,
            firstName: "Employé",
            lastName: uid,
            isActive: true
          }
        });
      }
    }

    // 3. Map & Validate Punch Records
    const validPunches: Array<{
      sn: number;
      zktecoUserId: string;
      recordTime: Date;
      type: number;
      state: number;
      ip: string;
    }> = [];

    const affectedDates: Date[] = [];

    for (const r of records) {
      const zktecoUserId = String(r.zktecoUserId || r.user_id || "").trim();
      const rawTime = r.recordTime || r.record_time;
      if (!zktecoUserId || !rawTime) continue;

      const dateObj = new Date(rawTime);
      if (isNaN(dateObj.getTime())) continue;

      const sn = typeof r.sn === "number" ? r.sn : parseInt(r.sn, 10) || 0;
      const type = typeof r.type === "number" ? r.type : parseInt(r.type, 10) || 0;
      const state = typeof r.state === "number" ? r.state : parseInt(r.state, 10) || 0;
      const ip = String(r.ip || deviceIp || "127.0.0.1");

      validPunches.push({
        sn,
        zktecoUserId,
        recordTime: dateObj,
        type,
        state,
        ip
      });

      affectedDates.push(dateObj);
    }

    // 4. Ingest Raw Punches (Primary source of truth - idempotent)
    let insertedCount = 0;
    if (validPunches.length > 0) {
      const result = await prisma.rawPunch.createMany({
        data: validPunches,
        skipDuplicates: true
      });
      insertedCount = result.count;
    }

    const receivedCount = records.length;
    const duplicatesCount = receivedCount - insertedCount;

    // 5. Trigger Server-Side Attendance Calculation (Resilient: failure does not lose raw punches)
    let calculationSuccess = true;
    let calculationError: string | null = null;

    if (affectedDates.length > 0) {
      try {
        await serverCalculationService.calculateDailyReportsForDates(affectedDates);
      } catch (calcErr: any) {
        console.warn("[DeviceSyncAPI] Warning: Server attendance calculation encountered an error:", calcErr);
        calculationSuccess = false;
        calculationError = calcErr.message || String(calcErr);
      }
    }

    // 6. Update Device and System Status
    const now = new Date();
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSyncAt: now,
        lastSeenAt: now,
        lastHeartbeat: now,
        syncStatus: "SUCCESS",
        syncError: calculationError ? `Punches saved. Calculation warning: ${calculationError}` : null,
        deviceIp: deviceIp || undefined
      }
    });

    await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: {
        syncStatus: "SUCCESS",
        syncError: null,
        lastHeartbeat: now,
        deviceOnline: true
      },
      create: {
        id: "singleton",
        syncStatus: "SUCCESS",
        syncError: null,
        lastHeartbeat: now,
        deviceOnline: true,
        adminPasswordHash: ""
      }
    });

    return NextResponse.json({
      success: true,
      received: receivedCount,
      inserted: insertedCount,
      duplicates: duplicatesCount,
      failed: 0,
      calculationSuccess,
      calculationError
    });
  } catch (error: any) {
    console.error("[DeviceSyncAPI] Fatal error processing sync:", error);

    try {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          syncStatus: "ERROR",
          syncError: error.message || String(error)
        }
      });
    } catch (_) {}

    return NextResponse.json(
      { error: "Internal server error during synchronization", details: error.message || String(error) },
      { status: 500 }
    );
  }
}
