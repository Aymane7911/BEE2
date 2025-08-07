import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConfirmationResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  user?: {
    id: number;
    email: string;
    firstname: string;
    lastname: string;
    organization: string;
    schemaName: string;
    isAdmin?: boolean;
    role?: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<ConfirmationResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const schemaName = searchParams.get('schema'); // Optional schema parameter

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    console.log(`Confirming email with token: ${token}, schema: ${schemaName || 'auto-detect'}`);

    // First, check if this is an admin confirmation token (in public schema)
    const adminConfirmation = await prisma.adminConfirmation.findUnique({
      where: { token },
      include: { 
        admin: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
            role: true,
            schemaName: true,
            displayName: true,
            isActive: true
          }
        }
      }
    });

    if (adminConfirmation) {
      console.log(`Found admin confirmation token for admin: ${adminConfirmation.admin.email}`);

      // Check if token is expired
      if (adminConfirmation.expiresAt < new Date()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Confirmation token has expired',
            details: 'Please request a new confirmation email'
          },
          { status: 400 }
        );
      }

      // Check if already confirmed
      if (adminConfirmation.confirmedAt) {
        return NextResponse.json(
          { 
            success: true,
            message: 'Admin email already confirmed',
            user: {
              id: adminConfirmation.admin.id,
              email: adminConfirmation.admin.email,
              firstname: adminConfirmation.admin.firstname,
              lastname: adminConfirmation.admin.lastname,
              organization: adminConfirmation.admin.displayName || 'Admin Portal',
              schemaName: adminConfirmation.admin.schemaName,
              isAdmin: true,
              role: adminConfirmation.admin.role
            }
          },
          { status: 200 }
        );
      }

      // Confirm the admin
      await prisma.adminConfirmation.update({
        where: { id: adminConfirmation.id },
        data: { confirmedAt: new Date() }
      });

      // Also update the corresponding user in the admin's schema (if exists)
      try {
        const adminSchemaName = adminConfirmation.admin.schemaName;
        const schemaPrisma = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL + `?schema=${adminSchemaName}`
            }
          }
        });

        await schemaPrisma.beeusers.updateMany({
          where: { 
            adminId: adminConfirmation.admin.id,
            isAdmin: true
          },
          data: { isConfirmed: true }
        });

        await schemaPrisma.$disconnect();
        console.log(`Updated admin user confirmation in schema: ${adminSchemaName}`);
      } catch (error) {
        console.warn('Could not update admin user in schema:', error);
      }

      console.log(`Admin email confirmed successfully: ${adminConfirmation.admin.email}`);

      return NextResponse.json(
        { 
          success: true,
          message: 'Admin email confirmed successfully! You can now access the admin dashboard.',
          user: {
            id: adminConfirmation.admin.id,
            email: adminConfirmation.admin.email,
            firstname: adminConfirmation.admin.firstname,
            lastname: adminConfirmation.admin.lastname,
            organization: adminConfirmation.admin.displayName || 'Admin Portal',
            schemaName: adminConfirmation.admin.schemaName,
            isAdmin: true,
            role: adminConfirmation.admin.role
          }
        },
        { status: 200 }
      );
    }

    // If not an admin token, check for regular user confirmation
    let targetPrisma = prisma;
    let targetSchemaName = schemaName;

    // If no schema provided, we need to search across schemas or use default
    if (!schemaName) {
      // Try to find which schema this token belongs to by checking common schemas
      // This is a fallback approach - ideally the schema should be provided in the URL
      console.log('No schema provided, searching in public schema as fallback');
    }

    if (targetSchemaName && targetSchemaName !== 'public') {
      targetPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL + `?schema=${targetSchemaName}`
          }
        }
      });
    }

    // Find user by confirmation token
    const user = await targetPrisma.beeusers.findFirst({
      where: { 
        confirmationToken: token,
        isConfirmed: false // Only find unconfirmed users
      }
    });

    if (!user) {
      console.log(`User not found with token: ${token} in schema: ${targetSchemaName || 'public'}`);
      
      // Check if user exists but is already confirmed
      const confirmedUser = await targetPrisma.beeusers.findFirst({
        where: {
          confirmationToken: token
        }
      });

      if (confirmedUser && confirmedUser.isConfirmed) {
        // Get admin info if this user has adminId
        let adminInfo = null;
        if (confirmedUser.adminId) {
          try {
            adminInfo = await prisma.admin.findUnique({
              where: { id: confirmedUser.adminId },
              select: { displayName: true, schemaName: true }
            });
          } catch (error) {
            console.warn('Could not fetch admin info:', error);
          }
        }

        return NextResponse.json(
          { 
            success: true,
            message: 'Email already confirmed',
            user: {
              id: confirmedUser.id,
              email: confirmedUser.email,
              firstname: confirmedUser.firstname,
              lastname: confirmedUser.lastname,
              organization: adminInfo?.displayName || 'Default',
              schemaName: adminInfo?.schemaName || targetSchemaName || 'public',
              isAdmin: confirmedUser.isAdmin,
              role: confirmedUser.role
            }
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired confirmation token',
          details: targetSchemaName ? `Token not found in schema ${targetSchemaName}` : 'Token not found'
        },
        { status: 400 }
      );
    }

    console.log(`Found user: ${user.email} in schema: ${targetSchemaName || 'public'}`);

    // Confirm the user
    const updatedUser = await targetPrisma.beeusers.update({
      where: { id: user.id },
      data: {
        isConfirmed: true,
        confirmationToken: null, // Clear the token after confirmation
      }
    });

    // Get admin info if this user has adminId
    let adminInfo = null;
    if (updatedUser.adminId) {
      try {
        adminInfo = await prisma.admin.findUnique({
          where: { id: updatedUser.adminId },
          select: { displayName: true, schemaName: true }
        });
      } catch (error) {
        console.warn('Could not fetch admin info:', error);
      }
    }

    console.log(`User email confirmed successfully: ${updatedUser.email}`);

    return NextResponse.json(
      { 
        success: true,
        message: 'Email confirmed successfully! You can now access your account.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          organization: adminInfo?.displayName || 'Default',
          schemaName: adminInfo?.schemaName || targetSchemaName || 'public',
          isAdmin: updatedUser.isAdmin,
          role: updatedUser.role
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming email:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to confirm email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Handle POST requests for form-based confirmation
export async function POST(request: NextRequest): Promise<NextResponse<ConfirmationResponse>> {
  try {
    const body = await request.json();
    const { token, schemaName } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    console.log(`POST confirmation with token: ${token}, schema: ${schemaName || 'auto-detect'}`);

    // First, check if this is an admin confirmation token
    const adminConfirmation = await prisma.adminConfirmation.findUnique({
      where: { token },
      include: { 
        admin: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
            role: true,
            schemaName: true,
            displayName: true
          }
        }
      }
    });

    if (adminConfirmation) {
      // Check if token is expired
      if (adminConfirmation.expiresAt < new Date()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Confirmation token has expired',
            details: 'Please request a new confirmation email'
          },
          { status: 400 }
        );
      }

      // Check if already confirmed
      if (adminConfirmation.confirmedAt) {
        return NextResponse.json(
          { 
            success: true,
            message: 'Admin email already confirmed',
            user: {
              id: adminConfirmation.admin.id,
              email: adminConfirmation.admin.email,
              firstname: adminConfirmation.admin.firstname,
              lastname: adminConfirmation.admin.lastname,
              organization: adminConfirmation.admin.displayName || 'Admin Portal',
              schemaName: adminConfirmation.admin.schemaName,
              isAdmin: true,
              role: adminConfirmation.admin.role
            }
          },
          { status: 200 }
        );
      }

      // Confirm the admin
      await prisma.adminConfirmation.update({
        where: { id: adminConfirmation.id },
        data: { confirmedAt: new Date() }
      });

      // Also update the corresponding user in the admin's schema
      try {
        const adminSchemaName = adminConfirmation.admin.schemaName;
        const schemaPrisma = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL + `?schema=${adminSchemaName}`
            }
          }
        });

        await schemaPrisma.beeusers.updateMany({
          where: { 
            adminId: adminConfirmation.admin.id,
            isAdmin: true
          },
          data: { isConfirmed: true }
        });

        await schemaPrisma.$disconnect();
      } catch (error) {
        console.warn('Could not update admin user in schema:', error);
      }

      return NextResponse.json(
        { 
          success: true,
          message: 'Admin email confirmed successfully! You can now access the admin dashboard.',
          user: {
            id: adminConfirmation.admin.id,
            email: adminConfirmation.admin.email,
            firstname: adminConfirmation.admin.firstname,
            lastname: adminConfirmation.admin.lastname,
            organization: adminConfirmation.admin.displayName || 'Admin Portal',
            schemaName: adminConfirmation.admin.schemaName,
            isAdmin: true,
            role: adminConfirmation.admin.role
          }
        },
        { status: 200 }
      );
    }

    // Handle regular user confirmation (same logic as GET)
    let targetPrisma = prisma;
    if (schemaName && schemaName !== 'public') {
      targetPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL + `?schema=${schemaName}`
          }
        }
      });
    }

    const user = await targetPrisma.beeusers.findFirst({
      where: { 
        confirmationToken: token,
        isConfirmed: false
      }
    });

    if (!user) {
      // Check if already confirmed
      const confirmedUser = await targetPrisma.beeusers.findFirst({
        where: {
          confirmationToken: token
        }
      });

      if (confirmedUser && confirmedUser.isConfirmed) {
        let adminInfo = null;
        if (confirmedUser.adminId) {
          try {
            adminInfo = await prisma.admin.findUnique({
              where: { id: confirmedUser.adminId },
              select: { displayName: true, schemaName: true }
            });
          } catch (error) {
            console.warn('Could not fetch admin info:', error);
          }
        }

        return NextResponse.json(
          { 
            success: true,
            message: 'Email already confirmed',
            user: {
              id: confirmedUser.id,
              email: confirmedUser.email,
              firstname: confirmedUser.firstname,
              lastname: confirmedUser.lastname,
              organization: adminInfo?.displayName || 'Default',
              schemaName: adminInfo?.schemaName || schemaName || 'public',
              isAdmin: confirmedUser.isAdmin,
              role: confirmedUser.role
            }
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired confirmation token',
          details: schemaName ? `Token not found in schema ${schemaName}` : 'Token not found'
        },
        { status: 400 }
      );
    }

    // Confirm the user
    const updatedUser = await targetPrisma.beeusers.update({
      where: { id: user.id },
      data: {
        isConfirmed: true,
        confirmationToken: null,
      }
    });

    // Get admin info if this user has adminId
    let adminInfo = null;
    if (updatedUser.adminId) {
      try {
        adminInfo = await prisma.admin.findUnique({
          where: { id: updatedUser.adminId },
          select: { displayName: true, schemaName: true }
        });
      } catch (error) {
        console.warn('Could not fetch admin info:', error);
      }
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Email confirmed successfully! You can now access your account.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          organization: adminInfo?.displayName || 'Default',
          schemaName: adminInfo?.schemaName || schemaName || 'public',
          isAdmin: updatedUser.isAdmin,
          role: updatedUser.role
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming email:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to confirm email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}