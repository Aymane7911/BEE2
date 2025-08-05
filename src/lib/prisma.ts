// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Helper function to get schema-specific Prisma client
export function getPrismaClient(schemaName?: string) {
  if (schemaName && schemaName !== 'public') {
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL + `?schema=${schemaName}`
        }
      }
    });
  }
  return prisma;
}

// Helper function to get user's schema context
export async function getUserSchemaContext(userId: number) {
  try {
    const user = await prisma.beeusers.findUnique({
      where: { id: userId },
      select: {
        adminId: true,
        isAdmin: true
      }
    });

    if (user?.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: user.adminId },
        select: {
          schemaName: true,
          displayName: true,
          id: true
        }
      });
      
      if (admin) {
        return {
          schemaName: admin.schemaName,
          organizationName: admin.displayName,
          adminId: admin.id
        };
      }
    }

    return {
      schemaName: 'public',
      organizationName: 'Public',
      adminId: null
    };
  } catch (error) {
    console.error('Error getting user schema context:', error);
    return {
      schemaName: 'public',
      organizationName: 'Public',
      adminId: null
    };
  }
}

