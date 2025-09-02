// app/api/admin/login/route.ts - Complete Enhanced Version with Email Confirmation
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getMasterPrismaClient } from '@/lib/prisma-manager';

interface LoginRequest {
  // Email/Password login
  email?: string;
  password?: string;
  authType: 'email_password' | 'google' | 'google_verify_session';
  
  // Google OAuth login
  googleAuthCode?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  verified_email: boolean;
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
    schemaName: admin.schemaName,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(tokenPayload, jwtSecret);
}

// Exchange Google auth code for user info
async function getGoogleUserInfo(authCode: string): Promise<GoogleUserInfo> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenData.error_description || 'Unknown error'}`);
  }

  // Get user info using access token
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const userData = await userResponse.json();
  
  if (!userResponse.ok) {
    throw new Error(`User info fetch failed: ${userData.error?.message || 'Unknown error'}`);
  }

  return userData;
}

// Login admin with email/password - WITH CONFIRMATION CHECK
async function loginAdminWithCredentials(email: string, password: string) {
  console.log('🔐 Attempting email/password login for:', email);
  
  const masterPrisma = getMasterPrismaClient();
  
  const adminRecord = await masterPrisma.admin.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      confirmation: true // Include confirmation data
    }
  });

  if (!adminRecord) {
    throw new Error('Invalid email or password');
  }

  if (!adminRecord.isActive) {
    throw new Error('Account is inactive');
  }

  // CHECK EMAIL CONFIRMATION
  if (!adminRecord.confirmation || !adminRecord.confirmation.confirmedAt) {
    throw new Error('Email not confirmed. Please check your email and confirm your account before logging in.');
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, adminRecord.password);
  if (!passwordValid) {
    throw new Error('Invalid email or password');
  }

  if (!adminRecord.schemaName) {
    throw new Error('No schema associated with admin account');
  }

  return adminRecord;
}

// Login admin with Google OAuth - WITH CONFIRMATION CHECK
async function loginAdminWithGoogle(googleAuthCode: string) {
  console.log('🔐 Attempting Google OAuth login');
  
  // Get user info from Google
  const googleUser = await getGoogleUserInfo(googleAuthCode);
  
  if (!googleUser.verified_email) {
    throw new Error('Google email not verified');
  }
  
  const masterPrisma = getMasterPrismaClient();
  
  // Find admin by Google email
  const adminRecord = await masterPrisma.admin.findUnique({
    where: { email: googleUser.email.toLowerCase() },
    include: {
      confirmation: true // Include confirmation data
    }
  });

  if (!adminRecord) {
    throw new Error('No admin account found for this Google account');
  }

  if (!adminRecord.isActive) {
    throw new Error('Account is inactive');
  }

  // CHECK EMAIL CONFIRMATION FOR GOOGLE LOGIN TOO
  if (!adminRecord.confirmation || !adminRecord.confirmation.confirmedAt) {
    throw new Error('Email not confirmed. Please confirm your account before logging in.');
  }

  if (!adminRecord.schemaName) {
    throw new Error('No schema associated with admin account');
  }

  console.log('✅ Google OAuth login successful:', {
    id: adminRecord.id,
    email: adminRecord.email,
    schemaName: adminRecord.schemaName
  });

  return adminRecord;
}

// Verify existing session - WITH CONFIRMATION CHECK
async function verifyExistingSession(email: string, request: NextRequest) {
  console.log('🔐 Verifying existing session for:', email);
  
  const adminToken = request.cookies.get('admin-token');
  
  if (!adminToken) {
    throw new Error('No active session found');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(adminToken.value, jwtSecret) as any;
    
    if (decoded.email !== email.toLowerCase()) {
      throw new Error('Session email mismatch');
    }

    const masterPrisma = getMasterPrismaClient();
    
    // Get fresh admin data WITH confirmation check
    const adminRecord = await masterPrisma.admin.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        confirmation: true // Include confirmation data
      }
    });

    if (!adminRecord || !adminRecord.isActive) {
      throw new Error('Admin account not found or inactive');
    }

    // CHECK CONFIRMATION IN SESSION VERIFICATION TOO
    if (!adminRecord.confirmation || !adminRecord.confirmation.confirmedAt) {
      throw new Error('Email not confirmed. Please confirm your account.');
    }

    return adminRecord;
    
  } catch (error) {
    throw new Error('Invalid or expired session');
  }
}

// Common function to create login response
function createLoginResponse(adminRecord: any) {
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
    const { email, password, authType, googleAuthCode } = body;

    let adminRecord: any;
    let loginResult: any;

    // Handle different authentication types
    switch (authType) {
      case 'email_password':
        // Standard email/password login
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

        console.log('📧 Email/password login attempt for:', email);
        adminRecord = await loginAdminWithCredentials(email.trim().toLowerCase(), password);
        loginResult = createLoginResponse(adminRecord);
        break;

      case 'google':
        // Google OAuth login
        if (!googleAuthCode) {
          return NextResponse.json<LoginResponse>(
            { success: false, error: 'Google authentication code is required' },
            { status: 400 }
          );
        }

        console.log('📧 Google OAuth login attempt');
        adminRecord = await loginAdminWithGoogle(googleAuthCode);
        loginResult = createLoginResponse(adminRecord);
        break;

      case 'google_verify_session':
        // Verify existing Google session
        if (!email) {
          return NextResponse.json<LoginResponse>(
            { success: false, error: 'Email is required for session verification' },
            { status: 400 }
          );
        }

        console.log('📧 Google session verification for:', email);
        adminRecord = await verifyExistingSession(email.trim().toLowerCase(), request);
        loginResult = createLoginResponse(adminRecord);
        break;

      default:
        return NextResponse.json<LoginResponse>(
          { success: false, error: 'Invalid authentication type' },
          { status: 400 }
        );
    }

    console.log('✅ Login successful for:', adminRecord.email);

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
      sameSite: 'lax',
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

    // NEW: Handle email confirmation errors
    if (error.message.includes('Email not confirmed')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Email not confirmed. Please check your email and confirm your account before logging in.' },
        { status: 403 }
      );
    }

    if (error.message.includes('No admin account found for this Google account')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'No admin account found for this Google account. Please use email/password login or contact support.' },
        { status: 404 }
      );
    }

    if (error.message.includes('Google email not verified')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Google email not verified. Please verify your email with Google first.' },
        { status: 400 }
      );
    }

    if (error.message.includes('No schema associated')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Account configuration incomplete. Please contact support.' },
        { status: 500 }
      );
    }

    if (error.message.includes('JWT_SECRET not configured') || 
        error.message.includes('Google OAuth not configured')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Authentication service misconfigured. Please contact support.' },
        { status: 500 }
      );
    }

    if (error.message.includes('Token exchange failed') || 
        error.message.includes('User info fetch failed')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Google authentication failed. Please try again.' },
        { status: 400 }
      );
    }

    if (error.message.includes('No active session found') || 
        error.message.includes('Invalid or expired session')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Session expired. Please sign in again.' },
        { status: 401 }
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
      { success: false, error: 'Authentication failed. Please try again.' },
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