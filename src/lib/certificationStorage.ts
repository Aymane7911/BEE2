// lib/certificationStorage.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CertificationData {
  batchIds: string[];
  certificationDate: string;
  totalCertified: string;
  certificationType: string;
  expiryDate: string;
  verification: string;
  totalJars: number;
  schemaName?: string; // Optional schema name for multi-tenant support
}

interface UserProfile {
  id: string;
  companyName?: string;
  name?: string;
  location?: string;
  schemaName?: string; // Optional schema context
}

// Helper function to get the right Prisma client for a schema
function getPrismaClient(schemaName?: string) {
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

// Function to store certification data (call this in your handleCompleteBatch function)
export async function storeCertificationData(
  certData: CertificationData, 
  userProfile: UserProfile
) {
  const targetPrisma = getPrismaClient(userProfile.schemaName || certData.schemaName);
  
  try {
    const certification = await targetPrisma.certification.create({
      data: {
        verificationCode: certData.verification,
        batchIds: certData.batchIds.join(','),
        certificationDate: new Date(certData.certificationDate),
        totalCertified: parseFloat(certData.totalCertified),
        certificationType: certData.certificationType,
        expiryDate: new Date(certData.expiryDate),
        totalJars: certData.totalJars,
        companyName: userProfile.companyName || null,
        beekeeperName: userProfile.name || null,
        location: userProfile.location || null,
        userId: parseInt(userProfile.id), // Convert string to number
      },
    });

    console.log('Certification stored successfully:', certification.id);
    return certification;
  } catch (error) {
    console.error('Error storing certification data:', error);
    throw error;
  } finally {
    if (targetPrisma !== prisma) {
      await targetPrisma.$disconnect();
    }
  }
}

// Function to fetch certification data (used by the API)
export async function fetchCertificationData(
  verificationCode: string, 
  schemaName?: string
) {
  const targetPrisma = getPrismaClient(schemaName);
  
  try {
    const certification = await targetPrisma.certification.findFirst({
      where: {
        verificationCode: verificationCode
      },
      include: {
        user: {
          select: {
            firstname: true,
            lastname: true,
          }
        }
      }
    });

    if (!certification) {
      return null;
    }

    return {
      batchIds: certification.batchIds.split(','),
      certificationDate: certification.certificationDate.toISOString().split('T')[0],
      totalCertified: certification.totalCertified.toString(),
      certificationType: certification.certificationType,
      expiryDate: certification.expiryDate.toISOString().split('T')[0],
      verification: certification.verificationCode,
      totalJars: certification.totalJars,
      companyName: certification.companyName,
      beekeeperName: certification.beekeeperName || `${certification.user?.firstname} ${certification.user?.lastname}`.trim(),
      location: certification.location,
      createdAt: certification.createdAt.toISOString(),
      schemaName: schemaName // Include schema info in response
    };
  } catch (error) {
    console.error('Error fetching certification data:', error);
    throw error;
  } finally {
    if (targetPrisma !== prisma) {
      await targetPrisma.$disconnect();
    }
  }
}

// Function to get all certifications for a user
export async function getUserCertifications(userId: string, schemaName?: string) {
  const targetPrisma = getPrismaClient(schemaName);
  
  try {
    const certifications = await targetPrisma.certification.findMany({
      where: { userId: parseInt(userId) }, // Convert string to number
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        verificationCode: true,
        batchIds: true,
        certificationDate: true,
        totalCertified: true,
        certificationType: true,
        expiryDate: true,
        totalJars: true,
        createdAt: true,
        companyName: true,
        beekeeperName: true,
        location: true
      }
    });

    return certifications.map(cert => ({
      ...cert,
      batchIds: cert.batchIds.split(','),
      certificationDate: cert.certificationDate.toISOString().split('T')[0],
      expiryDate: cert.expiryDate.toISOString().split('T')[0],
      totalCertified: cert.totalCertified.toString(),
      createdAt: cert.createdAt.toISOString()
    }));
  } catch (error) {
    console.error('Error fetching user certifications:', error);
    throw error;
  } finally {
    if (targetPrisma !== prisma) {
      await targetPrisma.$disconnect();
    }
  }
}

// Function to search certifications across schemas (for admin use)
export async function searchCertificationAcrossSchemas(verificationCode: string) {
  try {
    // First, get all admin schemas
    const admins = await prisma.admin.findMany({
      select: {
        schemaName: true,
        displayName: true
      }
    });

    // Search in each schema
    for (const admin of admins) {
      try {
        const result = await fetchCertificationData(verificationCode, admin.schemaName);
        if (result) {
          return {
            ...result,
            organizationName: admin.displayName,
            schemaName: admin.schemaName
          };
        }
      } catch (error) {
        console.warn(`Error searching in schema ${admin.schemaName}:`, error);
        // Continue searching other schemas
      }
    }

    // Also search in public schema as fallback
    try {
      const result = await fetchCertificationData(verificationCode, 'public');
      if (result) {
        return {
          ...result,
          organizationName: 'Public',
          schemaName: 'public'
        };
      }
    } catch (error) {
      console.warn('Error searching in public schema:', error);
    }

    return null;
  } catch (error) {
    console.error('Error searching certifications across schemas:', error);
    throw error;
  }
}

// Function to get user's schema context
export async function getUserSchemaContext(userId: number) {
  try {
    // Try to find user in current context first
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
          displayName: true
        }
      });
      
      if (admin) {
        return {
          schemaName: admin.schemaName,
          organizationName: admin.displayName
        };
      }
    }

    return {
      schemaName: 'public',
      organizationName: 'Public'
    };
  } catch (error) {
    console.error('Error getting user schema context:', error);
    return {
      schemaName: 'public',
      organizationName: 'Public'
    };
  }
}