// app/api/admin/confirm-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publicDb, getSchemaConnection } from '@/lib/database-connection';

interface ConfirmationRequest {
  token: string;
}

interface ConfirmationResponse {
  success: boolean;
  message: string;
  error?: string;
  admin?: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ConfirmationResponse>> {
  console.log('🔐 Processing email confirmation...');
  
  try {
    const { token }: ConfirmationRequest = await request.json();
    
    if (!token) {
      return NextResponse.json<ConfirmationResponse>(
        { 
          success: false, 
          message: 'Confirmation failed',
          error: 'No confirmation token provided' 
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Looking up confirmation token: ${token.substring(0, 8)}...`);

    // Find the confirmation record
    const confirmationRecord = await publicDb.adminConfirmation.findUnique({
      where: { token },
      include: {
        admin: true
      }
    });

    if (!confirmationRecord) {
      console.log('❌ Confirmation token not found');
      return NextResponse.json<ConfirmationResponse>(
        { 
          success: false, 
          message: 'Invalid confirmation link',
          error: 'Confirmation token not found or invalid' 
        },
        { status: 404 }
      );
    }

    // Check if already confirmed
    if (confirmationRecord.confirmedAt) {
      console.log('⚠️ Email already confirmed');
      return NextResponse.json<ConfirmationResponse>(
        { 
          success: false, 
          message: 'Email already confirmed',
          error: 'This confirmation link has already been used' 
        },
        { status: 409 }
      );
    }

    // Check if token expired
    if (new Date() > confirmationRecord.expiresAt) {
      console.log('⏰ Confirmation token expired');
      return NextResponse.json<ConfirmationResponse>(
        { 
          success: false, 
          message: 'Confirmation link expired',
          error: 'This confirmation link has expired. Please register again.' 
        },
        { status: 410 }
      );
    }

    const admin = confirmationRecord.admin;
    console.log(`✅ Valid confirmation for admin: ${admin.email}`);

    try {
      // Start a transaction to update both confirmation and admin user
      await publicDb.$transaction(async (tx) => {
        // Update confirmation record
        await tx.adminConfirmation.update({
          where: { id: confirmationRecord.id },
          data: {
            confirmedAt: new Date(),
          }
        });

        console.log('✅ Confirmation record updated');

        // Update admin user in their schema to confirmed status
        try {
          const schemaPrisma = await getSchemaConnection(admin.schemaName);
          
          // Find and update the admin user in the schema
          const adminUser = await schemaPrisma.beeusers.findFirst({
            where: {
              adminId: admin.id,
              isAdmin: true
            }
          });

          if (adminUser) {
            await schemaPrisma.beeusers.update({
              where: { id: adminUser.id },
              data: {
                isConfirmed: true,
              }
            });
            console.log(`✅ Admin user confirmed in schema: ${admin.schemaName}`);
          } else {
            console.log(`⚠️ Admin user not found in schema: ${admin.schemaName}`);
          }

        } catch (schemaError) {
          console.error('❌ Failed to update admin user in schema:', schemaError);
          // Don't fail the entire confirmation for this
        }
      });

      console.log('🎉 Email confirmation completed successfully!');

      return NextResponse.json<ConfirmationResponse>({
        success: true,
        message: `Welcome ${admin.firstname}! Your admin account has been confirmed successfully. You can now access the admin dashboard.`,
        admin: {
          id: admin.id,
          firstname: admin.firstname,
          lastname: admin.lastname,
          email: admin.email,
          role: admin.role,
        }
      }, { status: 200 });

    } catch (updateError: any) {
      console.error('❌ Failed to update confirmation status:', updateError);
      return NextResponse.json<ConfirmationResponse>(
        { 
          success: false, 
          message: 'Confirmation failed',
          error: 'Database error occurred during confirmation' 
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Email confirmation error:', error);

    if (error.message.includes('JSON')) {
      return NextResponse.json<ConfirmationResponse>(
        { 
          success: false, 
          message: 'Invalid request',
          error: 'Invalid request format' 
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ConfirmationResponse>(
      { 
        success: false, 
        message: 'Confirmation failed',
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse<ConfirmationResponse>> {
  return NextResponse.json(
    { 
      success: false, 
      message: 'Method not allowed',
      error: 'GET method not supported for email confirmation' 
    },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<ConfirmationResponse>> {
  return NextResponse.json(
    { 
      success: false, 
      message: 'Method not allowed',
      error: 'PUT method not supported for email confirmation' 
    },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<ConfirmationResponse>> {
  return NextResponse.json(
    { 
      success: false, 
      message: 'Method not allowed',
      error: 'DELETE method not supported for email confirmation' 
    },
    { status: 405 }
  );
}

export type { ConfirmationRequest, ConfirmationResponse };