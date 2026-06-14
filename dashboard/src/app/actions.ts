"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { getSession, createSession, deleteSession } from "@/lib/session";
import bcrypt from "bcrypt";

const execAsync = promisify(exec);

// Helper to verify that the administrator is authenticated
async function verifyAuth() {
  const session = await getSession();
  if (!session || session.adminId !== "admin") {
    throw new Error("Unauthorized access. Admin session is required.");
  }
}

// Input validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateIpAddress(ip: string): boolean {
  const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

export async function triggerDeviceSync() {
  await verifyAuth();
  
  try {
    // Set syncRequested to true and syncStatus to PENDING in SystemSettings
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        syncRequested: true,
        syncStatus: "PENDING",
        syncError: null
      }
    });

    // Poll the database for the status to change from PENDING/RUNNING to SUCCESS/ERROR
    const timeoutMs = 45000; // 45 seconds timeout
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const settings = await prisma.systemSettings.findFirst({
        select: { syncStatus: true, syncError: true }
      });
      
      if (settings) {
        if (settings.syncStatus === "SUCCESS") {
          revalidatePath("/");
          revalidatePath("/artisans");
          revalidatePath("/anomalies");
          return { success: true };
        }
        if (settings.syncStatus === "ERROR") {
          return { success: false, error: settings.syncError || "Sync failed on bridge device." };
        }
      }
    }
    
    // If we timeout, reset the sync request to IDLE
    await prisma.systemSettings.update({
      where: { id: "singleton" },
      data: {
        syncRequested: false,
        syncStatus: "IDLE",
        syncError: "Sync request timed out."
      }
    });
    
    return { success: false, error: "Sync request timed out. Make sure the Raspberry Pi bridge is online and running." };
  } catch (error) {
    console.error("Failed to sync:", error);
    return { success: false, error: String(error) };
  }
}


export async function createShift(formData: FormData) {
  await verifyAuth();

  const name = formData.get("name") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const baseHoursRaw = formData.get("baseHours") as string;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Shift name is required" };
  }
  
  const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { success: false, error: "Start and end times must be in HH:MM format" };
  }

  const baseHours = parseFloat(baseHoursRaw);
  if (isNaN(baseHours) || baseHours < 0 || baseHours > 24) {
    return { success: false, error: "Base hours must be a valid number between 0 and 24" };
  }

  await prisma.shift.create({
    data: { name: name.trim(), startTime, endTime, baseHours }
  });

  revalidatePath("/shifts");
  return { success: true };
}

export async function updateArtisanShift(userId: string, shiftId: string) {
  await verifyAuth();

  if (!userId || typeof userId !== "string") {
    return { success: false, error: "Invalid user identifier" };
  }

  // Validate shiftId if provided (can be empty string to unassign)
  if (shiftId) {
    const shiftExists = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shiftExists) {
      return { success: false, error: "Shift does not exist" };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { shiftId: shiftId || null }
  });

  revalidatePath("/artisans");
  return { success: true };
}

export async function resolveAnomaly(reportId: string, manualPunchOutTime: string) {
  await verifyAuth();

  if (!reportId || typeof reportId !== "string") {
    return { success: false, error: "Invalid report identifier" };
  }

  const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  if (!manualPunchOutTime || !timeRegex.test(manualPunchOutTime)) {
    return { success: false, error: "Invalid manual punch-out time format. Must be HH:MM" };
  }

  // 1. Get the existing report
  const report = await prisma.calculatedDailyReport.findUnique({
    where: { id: reportId },
    include: { user: { include: { shift: true } } }
  });

  if (!report || !report.firstPunchIn) return { success: false, error: "Invalid report" };

  // 2. Parse the new date
  const punchOutDate = new Date(report.date);
  const [hours, minutes] = manualPunchOutTime.split(":").map(Number);
  punchOutDate.setHours(hours, minutes, 0, 0);

  // 3. Calculate hours
  const diffMs = punchOutDate.getTime() - report.firstPunchIn.getTime();
  const totalHours = Math.max(0, diffMs / (1000 * 60 * 60));

  const baseHours = report.user.shift?.baseHours || 8;
  const regularHours = Math.min(totalHours, baseHours);
  
  // Assuming standard local overtime rules
  const extraHours = Math.max(0, totalHours - baseHours);
  const overtime150Hours = Math.min(extraHours, 2);
  const overtime200Hours = Math.max(0, extraHours - 2);

  // 4. Update the report to RESOLVED
  await prisma.calculatedDailyReport.update({
    where: { id: reportId },
    data: {
      lastPunchOut: punchOutDate,
      regularHours: Number(regularHours.toFixed(2)),
      overtime150Hours: Number(overtime150Hours.toFixed(2)),
      overtime200Hours: Number(overtime200Hours.toFixed(2)),
      status: 'RESOLVED',
      anomalyReason: null
    }
  });

  revalidatePath("/");
  revalidatePath("/anomalies");
  return { success: true };
}

// =======================
// SYSTEM SETTINGS & AUTH
// =======================

export async function loginAdmin(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || email.trim().length === 0 || password.length === 0) {
    return { success: false, error: "Email and password are required" };
  }

  if (!validateEmail(email)) {
    return { success: false, error: "Invalid email format" };
  }

  const settings = await prisma.systemSettings.findFirst();
  if (!settings || settings.adminEmail !== email) {
    return { success: false, error: "Invalid credentials" };
  }

  const isMatch = await bcrypt.compare(password, settings.adminPasswordHash);
  if (!isMatch) {
    return { success: false, error: "Invalid credentials" };
  }

  await createSession("admin");
  return { success: true };
}

export async function logoutAdmin() {
  await deleteSession();
  return { success: true };
}

export async function updateConnectionSettings(formData: FormData) {
  await verifyAuth();

  const deviceIp = formData.get("deviceIp") as string;
  const devicePortRaw = formData.get("devicePort") as string;
  const deviceTimeoutRaw = formData.get("deviceTimeout") as string;

  if (!deviceIp || !validateIpAddress(deviceIp)) {
    return { success: false, error: "Invalid IP Address format" };
  }

  const devicePort = parseInt(devicePortRaw);
  if (isNaN(devicePort) || devicePort < 1 || devicePort > 65535) {
    return { success: false, error: "Port must be a valid number between 1 and 65535" };
  }

  const deviceTimeout = parseInt(deviceTimeoutRaw);
  if (isNaN(deviceTimeout) || deviceTimeout < 500 || deviceTimeout > 60000) {
    return { success: false, error: "Timeout must be a valid number between 500 and 60000 ms" };
  }

  await prisma.systemSettings.update({
    where: { id: "singleton" },
    data: { deviceIp, devicePort, deviceTimeout }
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function updateAdminCredentials(formData: FormData) {
  await verifyAuth();

  const adminEmail = formData.get("adminEmail") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!adminEmail || !validateEmail(adminEmail)) {
    return { success: false, error: "Invalid admin email format" };
  }

  const updateData: any = { adminEmail };
  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long" };
    }
    updateData.adminPasswordHash = await bcrypt.hash(newPassword, 10);
  }

  await prisma.systemSettings.update({
    where: { id: "singleton" },
    data: updateData
  });

  revalidatePath("/settings");
  return { success: true };
}

