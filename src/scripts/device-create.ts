import { prisma } from "../config/database";
import crypto from "crypto";

function parseArgs() {
  const args = process.argv.slice(2);
  let deviceId = "FACTORY-01";
  let name = "Pointeuse ZKTeco Principale";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" || args[i] === "-i") {
      deviceId = args[i + 1] || deviceId;
      i++;
    } else if (args[i] === "--name" || args[i] === "-n") {
      name = args[i + 1] || name;
      i++;
    }
  }

  return { deviceId: deviceId.trim(), name: name.trim() };
}

async function main() {
  const { deviceId, name } = parseArgs();

  console.log(`\nProvisioning device with ID: ${deviceId} (${name})...`);

  // Generate 32-byte cryptographically secure random raw token (64 hex characters)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  try {
    const device = await prisma.device.upsert({
      where: { deviceId },
      update: {
        name,
        tokenHash,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        deviceId,
        name,
        tokenHash,
        isActive: true
      }
    });

    console.log("\n============================================================");
    console.log("  DEVICE PROVISIONED SUCCESSFULLY!");
    console.log("============================================================");
    console.log(`  Database ID:  ${device.id}`);
    console.log(`  Device ID:    ${device.deviceId}`);
    console.log(`  Device Name:  ${device.name}`);
    console.log(`  Device Token: ${rawToken}`);
    console.log("============================================================");
    console.log("  IMPORTANT:");
    console.log("  1. Copy this raw token now. It is hashed and cannot be shown again.");
    console.log("  2. Configure these variables on the Raspberry Pi (.env):\n");
    console.log(`     API_BASE_URL="https://pointage.client.ma"`);
    console.log(`     DEVICE_ID="${device.deviceId}"`);
    console.log(`     DEVICE_TOKEN="${rawToken}"`);
    console.log("============================================================\n");
  } catch (error) {
    console.error("Failed to provision device:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
