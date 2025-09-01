// app/api/auth/google/callback/route.ts - Fixed Admin Authentication

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getMasterPrismaClient } from '@/lib/prisma-manager';

interface GoogleUserData {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  verified_email?: boolean;
}

interface AdminOAuthResult {
  success: boolean;
  token: string;
  redirectUrl: string;
  admin: {
    id: number;
    email: string;
    firstname: string;
    lastname: string;
    role: string;
    schemaName: string;
  };
}

// Generate JWT token for admin (matching your login route format)
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

// Handle admin Google authentication
async function handleAdminGoogleAuth(googleUserData: GoogleUserData, redirectTo: string): Promise<AdminOAuthResult> {
  console.log('[ADMIN AUTH] Processing admin Google authentication for:', googleUserData.email);
  
  const masterPrisma = getMasterPrismaClient();
  
  try {
    // Find admin by email
    const adminRecord = await masterPrisma.admin.findUnique({
      where: { email: googleUserData.email.toLowerCase() },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        schemaName: true,
        displayName: true,
        description: true,
        isActive: true,
      }
    });

    if (!adminRecord) {
      throw new Error('No admin account found for this Google account');
    }

    if (!adminRecord.isActive) {
      throw new Error('Account is inactive');
    }

    if (!adminRecord.schemaName) {
      throw new Error('No schema associated with admin account');
    }

    console.log('[ADMIN AUTH] ✓ Admin found and validated:', adminRecord.email);

    // Generate JWT token using same logic as login route
    const token = generateAdminToken(adminRecord);

    return {
      success: true,
      token,
      redirectUrl: redirectTo, // This will now correctly use '/admin/dashboard'
      admin: {
        id: adminRecord.id,
        email: adminRecord.email,
        firstname: adminRecord.firstname,
        lastname: adminRecord.lastname,
        role: adminRecord.role,
        schemaName: adminRecord.schemaName
      }
    };

  } catch (error: any) {
    console.error('[ADMIN AUTH ERROR]', error.message);
    throw error;
  }
}

async function handleGoogleOAuth(code: string, state?: string): Promise<AdminOAuthResult> {
  console.log('=== GOOGLE OAUTH START ===');
  
  try {
    // Step 1: Parse state parameter - FIX THE REDIRECT URL
    console.log('[STEP 1] Parsing state parameter...');
    let authType = 'regular';
    let redirectTo = '/admin/dashboard'; // DEFAULT TO DASHBOARD, NOT LOGIN
    
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        // Fix: Check for both 'type' (from frontend) AND 'userType' (legacy)
        authType = stateData.type || stateData.userType || 'regular';
        // FIXED: Always redirect to dashboard for admin, ignore redirectTo from state if it's login page
        if (authType === 'admin_login') {
          redirectTo = '/admin/dashboard'; // Force dashboard redirect
        } else {
          redirectTo = stateData.redirectTo || '/admin/dashboard';
        }
        console.log('[STEP 1] ✓ State parsed:', { authType, redirectTo });
      } catch (e) {
        console.log('[STEP 1] Failed to parse state, using dashboard default');
        redirectTo = '/admin/dashboard'; // Default to dashboard
      }
    }

    if (!code) {
      console.log('[ERROR] Missing authorization code');
      throw new Error('Authorization code is required');
    }
    console.log('[STEP 1] ✓ Authorization code received');

    // Step 2: Check environment variables
    console.log('[STEP 2] Checking environment variables...');
    const requiredEnvVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET', 
      'JWT_SECRET',
      'DATABASE_URL',
      'NEXT_PUBLIC_SITE_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.log('[ERROR] Missing environment variables:', missingVars);
      throw new Error(`Server configuration error: ${missingVars.join(', ')}`);
    }
    console.log('[STEP 2] ✓ All environment variables present');

    // Step 3: Exchange code for token
    console.log('[STEP 3] Exchanging code for access token...');
    const tokenParams = {
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`,
    };

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.log('[ERROR] Token exchange failed:', errorData);
      throw new Error(`Failed to exchange code for token: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[STEP 3] ✓ Token exchange successful');

    // Step 4: Get user info from Google
    console.log('[STEP 4] Fetching user info from Google...');
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.log('[ERROR] Failed to fetch user info:', errorText);
      throw new Error(`Failed to fetch user information: ${errorText}`);
    }

    const googleUserData: GoogleUserData = await userResponse.json();
    console.log('[STEP 4] ✓ Google user data received for:', googleUserData.email);

    // Step 5: Handle admin authentication ONLY
    if (authType === 'admin_login') {
      return await handleAdminGoogleAuth(googleUserData, redirectTo);
    } else {
      // For non-admin attempts, redirect to regular login
      throw new Error('This endpoint is for admin authentication only');
    }

  } catch (error: any) {
    console.log('=== GOOGLE OAUTH ERROR ===');
    console.error('[FATAL ERROR]', error.message);
    console.error('[STACK TRACE]', error.stack);
    throw error;
  }
}

// Handle GET requests (Google OAuth redirect)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.log('[ERROR] OAuth error received:', error);
      const errorUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/login?error=oauth_error&message=${encodeURIComponent(error)}`;
      return NextResponse.redirect(errorUrl);
    }

    if (!code) {
      console.log('[ERROR] No authorization code received');
      const errorUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/login?error=no_code&message=${encodeURIComponent('No authorization code received')}`;
      return NextResponse.redirect(errorUrl);
    }

    // Process the OAuth
    const result = await handleGoogleOAuth(code, state || undefined);

    // FIXED: Create redirect URL to dashboard instead of login page
    const redirectUrl = new URL('/admin/dashboard', process.env.NEXT_PUBLIC_SITE_URL!);
    
    // Add success parameters for dashboard to process if needed
    redirectUrl.searchParams.set('google_auth_success', 'true');
    redirectUrl.searchParams.set('admin_id', result.admin.id.toString());
    redirectUrl.searchParams.set('user_email', result.admin.email);

    // Create response with redirect to dashboard
    const response = NextResponse.redirect(redirectUrl.toString());

    // Set HTTP-only cookie using same format as login route
    if (result.token) {
      response.cookies.set('admin-token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
      });
    }

    console.log('[OAUTH] ✓ Admin login successful, redirecting to dashboard:', redirectUrl.toString());
    return response;

  } catch (error: any) {
    console.error('GET OAuth Error:', error.message);
    
    // Map specific errors
    let errorType = 'server_error';
    let errorMessage = error.message;
    
    if (error.message.includes('No admin account found')) {
      errorType = 'admin_not_found';
    } else if (error.message.includes('Account is inactive')) {
      errorType = 'account_inactive';
    } else if (error.message.includes('No schema associated')) {
      errorType = 'no_schema';
    }
    
    // Redirect to admin login with error
    const errorUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/login?error=${errorType}&message=${encodeURIComponent(errorMessage)}`;
    return NextResponse.redirect(errorUrl);
  }
}

// Remove POST method or make it consistent with admin auth
export async function POST() {
  return NextResponse.json({ 
    message: 'Use GET method for OAuth callback' 
  }, { status: 405 });
}