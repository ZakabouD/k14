"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const database_1 = require("../config/database");
class UserRepository {
    async ensureUserExists(zktecoUserId, zktecoData) {
        const defaultName = zktecoData?.name || `User ${zktecoUserId}`;
        // Split the name safely if we want to guess first/last name
        // For now we'll put the whole name into firstName to avoid incorrect splitting
        const firstName = defaultName;
        const lastName = '';
        return database_1.prisma.user.upsert({
            where: { zktecoUserId },
            update: {
                // Only update firstName if we actually got a name from the device
                // and it's not empty. This avoids overwriting manual edits with blank data.
                ...(zktecoData?.name ? { firstName: zktecoData.name } : {}),
            },
            create: {
                zktecoUserId,
                firstName,
                lastName,
            },
        });
    }
    async getUserWithShift(userId) {
        return database_1.prisma.user.findUnique({
            where: { id: userId },
            include: { shift: true },
        });
    }
    async getAllUsersWithShifts() {
        return database_1.prisma.user.findMany({
            include: { shift: true },
        });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
