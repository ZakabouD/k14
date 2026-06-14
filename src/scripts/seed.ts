import { prisma } from '../config/database';
import bcrypt from 'bcrypt';

async function main() {
  console.log("Seeding Database...");

  const existingSettings = await prisma.systemSettings.findFirst();

  if (!existingSettings) {
    // Generate a strong, secure random password if none is provided via the environment
    const envPassword = process.env.ADMIN_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL || "admin@workshop.com";
    
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
        adminEmail: adminEmail,
        adminPasswordHash: hashedPassword,
        deviceIp: "192.168.11.201",
        devicePort: 4370,
        deviceTimeout: 15000,
      }
    });

    console.log("------------------------------------------------------------");
    console.log("Created System Settings successfully!");
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
