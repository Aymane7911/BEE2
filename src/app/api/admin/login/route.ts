// app/api/admin/login/route.ts - Schema-per-Tenant Version
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getMasterPrismaClient } from '@/lib/prisma-manager';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    token: string;
    admin: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      schemaName: string;
    };
    schema: {
      name: string;
      displayName: string;
      description?: string;
    };
  };
}

// Test database connection
async function testDatabaseConnection(): Promise<boolean> {
  try {
    const masterPrisma = getMasterPrismaClient();
    await masterPrisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection verified');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Generate JWT token for admin
function generateAdminToken(admin: any): string {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const tokenPayload = {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    schemaName: admin.schemaName, // ✅ Use schemaName (new system)
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(tokenPayload, jwtSecret);
}

// Login admin function
async function loginAdminWithSchema(email: string, password: string) {
  console.log('🔐 Attempting admin login for:', email);
  
  const masterPrisma = getMasterPrismaClient();
  
  try {
    // Find admin in master database
    const adminRecord = await masterPrisma.admin.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        password: true,
        role: true,
        schemaName: true,
        displayName: true,
        description: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!adminRecord) {
      console.log('❌ Admin not found:', email);
      throw new Error('Invalid email or password');
    }

    if (!adminRecord.isActive) {
      console.log('❌ Admin account inactive:', email);
      throw new Error('Account is inactive');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, adminRecord.password);
    if (!passwordValid) {
      console.log('❌ Invalid password for:', email);
      throw new Error('Invalid email or password');
    }

    // Check if schema name exists
    if (!adminRecord.schemaName) {
      console.log('❌ No schema associated with admin:', email);
      throw new Error('No schema associated with admin account');
    }

    console.log('✅ Admin login successful:', {
      id: adminRecord.id,
      email: adminRecord.email,
      schemaName: adminRecord.schemaName
    });

    // Generate JWT token
    const token = generateAdminToken(adminRecord);

    return {
      token,
      admin: {
        id: adminRecord.id,
        firstname: adminRecord.firstname,
        lastname: adminRecord.lastname,
        email: adminRecord.email,
        role: adminRecord.role,
        schemaName: adminRecord.schemaName
      },
      schema: {
        name: adminRecord.schemaName,
        displayName: adminRecord.displayName || `${adminRecord.firstname} ${adminRecord.lastname}'s Workspace`,
        description: adminRecord.description || undefined
      }
    };

  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  console.log('🚀 Admin login request received');
  
  // Test database connection first
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    return NextResponse.json<LoginResponse>(
      { 
        success: false, 
        error: 'Database service unavailable. Please try again later.' 
      },
      { status: 503 }
    );
  }

  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (password.length < 3) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Password is too short' },
        { status: 400 }
      );
    }

    console.log('📧 Login attempt for email:', email);

    // Attempt login with new schema system
    const loginResult = await loginAdminWithSchema(email.trim().toLowerCase(), password);

    console.log('✅ Login successful for:', email);

    // Create response
    const response = NextResponse.json<LoginResponse>({
      success: true,
      message: 'Login successful',
      data: loginResult,
    }, { status: 200 });

    // Set httpOnly cookie for security
    response.cookies.set('admin-token', loginResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    console.log('🍪 Admin token cookie set successfully');

    return response;

  } catch (error: any) {
    console.error('❌ Admin login error:', error);

    // Handle specific error types
    if (error.message.includes('Invalid email or password')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (error.message.includes('Account is inactive')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    if (error.message.includes('No schema associated')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Account configuration incomplete. Please contact support.' },
        { status: 500 }
      );
    }

    if (error.message.includes('JWT_SECRET not configured')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Authentication service misconfigured. Please contact support.' },
        { status: 500 }
      );
    }

    // Database connection errors
    if (error.message.includes('connection') || 
        error.message.includes('database') ||
        error.message.includes('timeout')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Database service unavailable. Please try again.' },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json<LoginResponse>(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json<LoginResponse>(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json<LoginResponse>(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json<LoginResponse>(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export type { LoginRequest, LoginResponse };