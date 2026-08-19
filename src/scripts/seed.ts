import { prisma } from '../config/database';
import bcrypt from 'bcrypt';

async function main() {
  console.log("Seeding Database...");

  const existingSettings = await prisma.systemSettings.findFirst();

  if (!existingSettings) {
    const envPassword = process.env.ADMIN_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const companyName = process.env.COMPANY_NAME || "Mon Entreprise";
    const currency = process.env.DEFAULT_CURRENCY || "DH";
    const timezone = process.env.TIMEZONE || "Africa/Casablanca";
    const deviceIp = process.env.ZKTECO_IP || "192.168.1.201";
    const devicePort = process.env.ZKTECO_PORT ? parseInt(process.env.ZKTECO_PORT, 10) : 4370;
    const deviceTimeout = process.env.ZKTECO_TIMEOUT ? parseInt(process.env.ZKTECO_TIMEOUT, 10) : 10000;
    
    let passwordToUse: string = envPassword || "";
    let isGenerated = false;

    if (passwordToUse.trim().length === 0) {
      const crypto = require('crypto');
      passwordToUse = crypto.randomBytes(12).toString('hex');
      isGenerated = true;
    }

    const hashedPassword: string = await bcrypt.hash(passwordToUse, 10);
    
    await prisma.systemSettings.create({
      data: {
        id: "singleton",
        companyName,
        currency,
        timezone,
        adminEmail,
        adminPasswordHash: hashedPassword,
        deviceIp,
        devicePort,
        deviceTimeout,
      }
    });

    console.log("------------------------------------------------------------");
    console.log("Created System Settings successfully!");
    console.log(`Company Name: ${companyName}`);
    console.log(`Admin Email: ${adminEmail}`);
    if (isGenerated) {
      console.log(`Generated Secure Admin Password: ${passwordToUse}`);
      console.log("PLEASE WRITE DOWN AND COPY THIS PASSWORD. IT WILL NOT BE SHOWN AGAIN.");
    } else {
      console.log("Admin Password: [As defined in environment variables]");
    }
    console.log("------------------------------------------------------------");
  } else {
    console.log("System Settings already exist. Skipping seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
