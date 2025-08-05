import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";
import fs from 'fs';
import path from 'path';

// GET - Get user profile (requires authentication)
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] GET /api/user/profile - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and schemaName from the auth result
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log(`[${requestId}] ▶ Authenticated user ID:`, userId, 'Schema:', schemaName);

    if (!userId || !schemaName) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userIdInt = parseInt(String(userId));
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // Initialize Prisma with tenant-specific schema
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL}?schema=${schemaName}`
        }
      }
    });

    console.log(`[${requestId}] ▶ Using schema:`, schemaName);

    // Fetch user profile
    const user = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        phonenumber: true,
        isConfirmed: true,
        phoneConfirmed: true,
        passportId: true,
        passportFile: true,
        isProfileComplete: true,
        isPremium: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.error(`[${requestId}] ▶ User not found:`, userIdInt);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`✅ [${requestId}] Successfully fetched profile for:`, user.email);

    return NextResponse.json(user, { status: 200 });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch profile',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] GET request completed`);
  }
}

// PUT - Update user profile (requires authentication)
export async function PUT(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] PUT /api/user/profile - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and schemaName from the auth result
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log(`[${requestId}] ▶ Authenticated user ID:`, userId, 'Schema:', schemaName);

    if (!userId || !schemaName) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userIdInt = parseInt(String(userId));
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // Initialize Prisma with tenant-specific schema
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL}?schema=${schemaName}`
        }
      }
    });

    console.log(`[${requestId}] ▶ Using schema:`, schemaName);

    const body = await request.json();
    const { firstname, lastname, phonenumber } = body;

    console.log(`📥 [${requestId}] Request body:`, { firstname, lastname, phonenumber });

    // Validate input
    if (!firstname || !lastname) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    // Verify user exists first
    const existingUser = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { id: true, email: true }
    });

    if (!existingUser) {
      console.error(`[${requestId}] ▶ User not found for update:`, userIdInt);
      return NextResponse.json(
        { error: 'User not found or access denied' },
        { status: 404 }
      );
    }

    // Update user profile
    const updatedUser = await prisma.beeusers.update({
      where: { id: userIdInt },
      data: {
        firstname,
        lastname,
        phonenumber,
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        phonenumber: true,
        isProfileComplete: true,
      },
    });

    console.log(`✅ [${requestId}] Successfully updated profile for:`, updatedUser.email);

    return NextResponse.json(updatedUser, { status: 200 });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    // Handle Prisma specific errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Unique constraint violation',
          details: 'This information is already in use',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to update profile',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] PUT request completed`);
  }
}

// POST - Update passport information with file upload (requires authentication)
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] POST /api/user/profile - Starting passport update request`);
  
  let prisma: PrismaClient | null = null;

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and schemaName from the auth result
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log(`[${requestId}] ▶ Authenticated user ID:`, userId, 'Schema:', schemaName);

    if (!userId || !schemaName) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userIdInt = parseInt(String(userId));
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // Initialize Prisma with tenant-specific schema
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL}?schema=${schemaName}`
        }
      }
    });

    console.log(`[${requestId}] ▶ Using schema:`, schemaName);

    // Parse form data
    const formData = await request.formData();
    const passportId = formData.get('passportId') as string;
    const passportScan = formData.get('passportScan') as File | null;

    console.log(`📥 [${requestId}] Passport update - ID:`, passportId, 'File:', passportScan?.name);

    // Validate required fields
    if (!passportId?.trim()) {
      return NextResponse.json(
        { error: 'Passport ID is required' },
        { status: 400 }
      );
    }

    let passportFilePath: string | null = null;

    // Handle file upload if present
    if (passportScan && passportScan.size > 0) {
      console.log(`📁 [${requestId}] Processing file upload:`, passportScan.name, 'Size:', passportScan.size);

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!allowedTypes.includes(passportScan.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only PNG, JPG, and PDF files are allowed.' },
          { status: 400 }
        );
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (passportScan.size > maxSize) {
        return NextResponse.json(
          { error: 'File size must be less than 10MB.' },
          { status: 400 }
        );
      }

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'passports');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`📁 [${requestId}] Created upload directory:`, uploadDir);
      }

      // Get existing user to check for old passport file
      const existingUser = await prisma.beeusers.findUnique({
        where: { id: userIdInt },
        select: { passportFile: true, email: true },
      });

      if (!existingUser) {
        console.error(`[${requestId}] ▶ User not found for passport update:`, userIdInt);
        return NextResponse.json(
          { error: 'User not found or access denied' },
          { status: 404 }
        );
      }

      // Generate unique filename
      const fileExtension = path.extname(passportScan.name);
      const fileName = `passport_${userIdInt}_${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);

      // Convert file to buffer and save
      const arrayBuffer = await passportScan.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      passportFilePath = `/uploads/passports/${fileName}`;
      console.log(`✅ [${requestId}] File saved successfully:`, passportFilePath);

      // Delete old passport file if it exists
      if (existingUser.passportFile) {
        const oldFilePath = path.join(process.cwd(), 'public', existingUser.passportFile);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log(`🗑️ [${requestId}] Deleted old passport file:`, existingUser.passportFile);
          } catch (deleteError) {
            console.warn(`⚠️ [${requestId}] Failed to delete old passport file:`, deleteError);
          }
        }
      }
    }

    // Update user profile in database
    const updatedUser = await prisma.beeusers.update({
      where: { id: userIdInt },
      data: {
        passportId: passportId.trim(),
        ...(passportFilePath && { passportFile: passportFilePath }),
        isProfileComplete: true,
      },
      select: {
        id: true,
        passportId: true,
        passportFile: true,
        isProfileComplete: true,
        email: true,
      },
    });

    console.log(`✅ [${requestId}] Successfully updated passport for:`, updatedUser.email);

    return NextResponse.json({
      success: true,
      message: 'Passport information updated successfully',
      user: {
        id: updatedUser.id,
        passportId: updatedUser.passportId,
        passportFile: updatedUser.passportFile,
        isProfileComplete: updatedUser.isProfileComplete,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    // Handle Prisma-specific errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { 
          error: 'This passport ID is already in use',
          details: 'Unique constraint violation'
        },
        { status: 409 }
      );
    }

    // Handle file system errors
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return NextResponse.json(
        { 
          error: 'File system error',
          details: 'Unable to save uploaded file'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to update passport information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] POST request completed`);
  }
}