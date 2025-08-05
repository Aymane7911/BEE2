import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const schemaName = searchParams.get('schema'); // Optional schema parameter

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    console.log(`Confirming email with token: ${token}, schema: ${schemaName || 'default'}`);

    // If schema is provided, switch to that schema context
    let targetPrisma = prisma;
    if (schemaName) {
      // Create a new Prisma instance with the specific schema
      targetPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL + `?schema=${schemaName}`
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
      console.log(`User not found with token: ${token} in schema: ${schemaName || 'default'}`);
      
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
              schemaName: adminInfo?.schemaName || schemaName || 'public'
            }
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Invalid or expired confirmation token',
          details: schemaName ? `Token not found in schema ${schemaName}` : 'Token not found'
        },
        { status: 400 }
      );
    }

    console.log(`Found user: ${user.email} in schema: ${schemaName || 'default'}`);

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

    console.log(`Email confirmed successfully for user: ${updatedUser.email}`);

    return NextResponse.json(
      { 
        success: true,
        message: 'Email confirmed successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          organization: adminInfo?.displayName || 'Default',
          schemaName: adminInfo?.schemaName || schemaName || 'public'
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to confirm email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: Handle POST requests for form-based confirmation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, schemaName } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    // If schema is provided, switch to that schema context
    let targetPrisma = prisma;
    if (schemaName) {
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
              schemaName: adminInfo?.schemaName || schemaName || 'public'
            }
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
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
        message: 'Email confirmed successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          organization: adminInfo?.displayName || 'Default',
          schemaName: adminInfo?.schemaName || schemaName || 'public'
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to confirm email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}