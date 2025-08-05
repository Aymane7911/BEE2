import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest, withTenantSchema } from '@/lib/admin-auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  console.log('=== Register as User API Started ===');
  
  try {
    // 1. Get admin session from request with detailed logging
    console.log('Step 1: Getting admin session from request...');
    
    let adminSession;
    try {
      adminSession = await getAdminFromRequest(request);
      console.log('✅ Admin session retrieved successfully');
      console.log('Admin session details:', {
        adminId: adminSession.adminId,
        email: adminSession.email,
        role: adminSession.role,
        schemaName: adminSession.schemaName
      });
    } catch (authError) {
      console.log('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError instanceof Error ? authError.message : 'Unknown error' },
        { status: 401 }
      );
    }

    // 2. Get admin details from public schema
    console.log('Step 2: Getting admin details from public schema...');
    
    let adminDetails;
    try {
      adminDetails = await prisma.admin.findUnique({
        where: { id: adminSession.adminId },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          role: true,
          isActive: true,
          schemaName: true,
          displayName: true
        }
      });

      if (!adminDetails) {
        console.log('❌ Admin not found in public schema');
        return NextResponse.json({
          error: 'Admin not found in public schema',
          details: {
            searchedForAdminId: adminSession.adminId
          }
        }, { status: 404 });
      }

      if (!adminDetails.isActive) {
        console.log('❌ Admin account is inactive');
        return NextResponse.json(
          { error: 'Admin account is inactive' },
          { status: 403 }
        );
      }

      console.log('✅ Admin validated successfully');
      console.log('Admin details:', {
        id: adminDetails.id,
        email: adminDetails.email,
        role: adminDetails.role,
        schemaName: adminDetails.schemaName,
        isActive: adminDetails.isActive
      });

    } catch (adminValidationError) {
      console.log('❌ Error validating admin:', adminValidationError);
      return NextResponse.json({
        error: 'Admin validation failed',
        details: adminValidationError instanceof Error ? adminValidationError.message : 'Unknown error'
      }, { status: 500 });
    }

    // 3. Check if admin is already registered as user in tenant schema
    console.log('Step 3: Checking if admin is already registered as user in tenant schema...');
    
    try {
      const existingUser = await withTenantSchema(adminSession.schemaName, async () => {
        return await prisma.beeusers.findFirst({
          where: {
            email: adminDetails.email,
          },
          select: {
            id: true,
            email: true,
            isAdmin: true,
            adminId: true,
            role: true,
            createdAt: true
          }
        });
      });

      if (existingUser) {
        console.log('⚠️ Admin is already registered as user');
        console.log('Existing user details:', existingUser);
        
        return NextResponse.json({
          message: 'Admin is already registered as user',
          user: existingUser
        }, { status: 200 });
      }

      console.log('✅ Admin is not yet registered as user, proceeding with creation');

    } catch (existingUserCheckError) {
      console.log('❌ Error checking existing user:', existingUserCheckError);
      return NextResponse.json({
        error: 'Failed to check existing user',
        details: existingUserCheckError instanceof Error ? existingUserCheckError.message : 'Unknown error'
      }, { status: 500 });
    }

    // 4. Create user record in tenant schema
    console.log('Step 4: Creating new user record in tenant schema...');
    
    const userData = {
      firstname: adminDetails.firstname,
      lastname: adminDetails.lastname,
      email: adminDetails.email,
      password: 'admin_placeholder', // You might want to handle this differently
      isAdmin: true,
      adminId: adminDetails.id,
      role: 'admin',
      isConfirmed: true, // Admin users should be auto-confirmed
      isProfileComplete: true
    };
    
    console.log('User data to be created:', {
      ...userData,
      password: '[REDACTED]'
    });

    try {
      const newUser = await withTenantSchema(adminSession.schemaName, async () => {
        return await prisma.beeusers.create({
          data: userData,
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
            role: true,
            isAdmin: true,
            adminId: true,
            createdAt: true,
            isConfirmed: true,
            isProfileComplete: true
          }
        });
      });

      console.log('✅ User created successfully in tenant schema');
      console.log('New user details:', newUser);

      return NextResponse.json({
        message: 'Admin registered as user successfully',
        user: newUser,
        schema: adminSession.schemaName
      }, { status: 201 });

    } catch (userCreationError) {
      console.log('❌ Error creating user:', userCreationError);
      
      // Enhanced error logging for Prisma errors
      if (userCreationError && typeof userCreationError === 'object') {
        const prismaError = userCreationError as any;
        console.log('Prisma error details:', {
          name: prismaError.name,
          code: prismaError.code,
          message: prismaError.message,
          meta: prismaError.meta,
          clientVersion: prismaError.clientVersion
        });

        // Specific handling for foreign key constraint errors
        if (prismaError.code === 'P2003') {
          console.log('Foreign key constraint violation details:');
          if (prismaError.meta && prismaError.meta.field_name) {
            console.log('Field causing issue:', prismaError.meta.field_name);
          }
          if (prismaError.meta && prismaError.meta.constraint) {
            console.log('Constraint name:', prismaError.meta.constraint);
          }
        }

        // Specific handling for unique constraint errors
        if (prismaError.code === 'P2002') {
          console.log('Unique constraint violation details:');
          if (prismaError.meta && prismaError.meta.target) {
            console.log('Fields causing conflict:', prismaError.meta.target);
          }
          
          return NextResponse.json({
            error: 'User with this email already exists in this schema',
            details: 'A user with this email address is already registered in this tenant.',
            errorCode: prismaError.code
          }, { status: 409 });
        }
      }

      return NextResponse.json({
        error: 'Failed to create user',
        details: userCreationError instanceof Error ? userCreationError.message : 'Unknown error',
        errorCode: (userCreationError as any)?.code,
        errorMeta: (userCreationError as any)?.meta,
        schema: adminSession.schemaName,
        userData: {
          ...userData,
          password: '[REDACTED]'
        }
      }, { status: 500 });
    }

  } catch (globalError) {
    console.log('❌ Global error in register-as-user API:', globalError);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: globalError instanceof Error ? globalError.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    console.log('=== Register as User API Completed ===');
  }
}