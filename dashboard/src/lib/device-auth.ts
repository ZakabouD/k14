import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import crypto from "crypto";

// Constant dummy hash to mitigate timing attacks when a deviceId is not found
const DUMMY_HASH = crypto.createHash("sha256").update("dummy_token_for_timing_safety").digest("hex");

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export type DeviceAuthResult = 
  | { success: true; device: { id: string; deviceId: string; name: string | null; isActive: boolean } }
  | { success: false; response: NextResponse };

/**
 * Authenticates an incoming HTTP request from a hardware bridge device
 * using x-device-id and x-device-token headers.
 */
export async function authenticateDevice(request: NextRequest): Promise<DeviceAuthResult> {
  const deviceId = request.headers.get("x-device-id") || request.headers.get("X-Device-Id");
  const deviceToken = request.headers.get("x-device-token") || request.headers.get("X-Device-Token");

  if (!deviceId || !deviceToken || deviceId.trim().length === 0 || deviceToken.trim().length === 0) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Unauthorized: Missing device authentication headers (x-device-id, x-device-token)" },
        { status: 401 }
      )
    };
  }

  const cleanDeviceId = deviceId.trim();
  const cleanToken = deviceToken.trim();
  const tokenHash = hashDeviceToken(cleanToken);

  try {
    const device = await prisma.device.findUnique({
      where: { deviceId: cleanDeviceId },
      select: {
        id: true,
        deviceId: true,
        name: true,
        tokenHash: true,
        isActive: true
      }
    });

    const expectedHash = device?.tokenHash || DUMMY_HASH;
    
    // Constant-time buffer comparison to prevent timing attacks
    const bufComputed = Buffer.from(tokenHash, "utf8");
    const bufExpected = Buffer.from(expectedHash, "utf8");
    
    const isTokenMatch = 
      bufComputed.length === bufExpected.length && 
      crypto.timingSafeEqual(bufComputed, bufExpected);

    if (!device || !isTokenMatch) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Unauthorized: Invalid device credentials" },
          { status: 401 }
        )
      };
    }

    if (!device.isActive) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Forbidden: This device has been deactivated" },
          { status: 403 }
        )
      };
    }

    return {
      success: true,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        name: device.name,
        isActive: device.isActive
      }
    };
  } catch (err) {
    console.error("[DeviceAuth] Internal error during authentication:", err);
    return {
      success: false,
      response: NextResponse.json(
        { error: "Internal server error during authentication" },
        { status: 500 }
      )
    };
  }
}
