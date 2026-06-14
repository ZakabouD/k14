import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

import { ZKTecoUser } from '../types/zkteco.types';

export class UserRepository {
  async ensureUserExists(zktecoUserId: string, zktecoData?: ZKTecoUser) {
    const defaultName = zktecoData?.name || `User ${zktecoUserId}`;
    
    // Split the name safely if we want to guess first/last name
    // For now we'll put the whole name into firstName to avoid incorrect splitting
    const firstName = defaultName;
    const lastName = '';

    return prisma.user.upsert({
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

  async getUserWithShift(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { shift: true },
    });
  }

  async getAllUsersWithShifts() {
    return prisma.user.findMany({
      include: { shift: true },
    });
  }
}

export const userRepository = new UserRepository();
