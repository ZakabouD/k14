"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function main() {
    console.log("Seeding Database...");
    const existingSettings = await database_1.prisma.systemSettings.findFirst();
    if (!existingSettings) {
        // Generate a strong, secure random password if none is provided via the environment
        const envPassword = process.env.ADMIN_PASSWORD;
        const adminEmail = process.env.ADMIN_EMAIL || "admin@workshop.com";
        let passwordToUse = envPassword || "";
        let isGenerated = false;
        if (passwordToUse.trim().length === 0) {
            const crypto = require('crypto');
            passwordToUse = crypto.randomBytes(12).toString('hex');
            isGenerated = true;
        }
        const hashedPassword = await bcrypt_1.default.hash(passwordToUse, 10);
        await database_1.prisma.systemSettings.create({
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
        }
        else {
            console.log("Admin Password: [As defined in environment variables]");
        }
        console.log("------------------------------------------------------------");
    }
    else {
        console.log("System Settings already exist. Skipping seed.");
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await database_1.prisma.$disconnect();
});
