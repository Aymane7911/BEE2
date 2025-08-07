// app/api/admin/logout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Admin Token Payload Interface
 */
interface AdminTokenPayload extends JwtPayload {
  id: number;
  email: string;
  role: string;
  schemaName: string;
  displayName: string;
}

/**
 * API Response Interface
 */
interface LogoutResponse {
  success: boolean;
  message: string;
  timestamp?: string;
  warning?: string;
  error?: string;
  code?: string;
}

/**
 * Admin Logout API Endpoint
 * POST /api/admin/logout
 */
export async function POST(request: NextRequest): Promise<NextResponse<LogoutResponse>> {
  const requestId = Math.random().toString(36).substring(7);
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  console.log(`[${requestId}] 🚪 Admin logout request initiated`);
  console.log(`[${requestId}] 📍 Client IP: ${clientIP}`);

  try {
    // Get the admin token from cookies - check both possible names
    let adminToken = request.cookies.get('adminToken')?.value || 
                    request.cookies.get('admin-token')?.value ||
                    request.cookies.get('admin_token')?.value; // Additional naming variation
    
    console.log(`[${requestId}] 🔍 Checking for admin token in cookies...`);
    console.log(`[${requestId}] 🍪 Available cookies: ${Array.from(request.cookies.getAll()).map(c => c.name).join(', ')}`);
    
    let adminData: AdminTokenPayload | null = null;

    // Validate and decode token if it exists
    if (adminToken) {
      console.log(`[${requestId}] ✅ Admin token found, length: ${adminToken.length} characters`);
      
      try {
        const decoded = jwt.verify(adminToken, process.env.JWT_SECRET!) as AdminTokenPayload;
        adminData = decoded;
        console.log(`[${requestId}] ✅ Token verified successfully`);
        console.log(`[${requestId}] 👤 Admin: ${adminData.email} (ID: ${adminData.id})`);
      } catch (tokenError) {
        console.warn(`[${requestId}] ⚠️  Invalid token during logout: ${(tokenError as Error).message}`);
      }
    } else {
      console.warn(`[${requestId}] ❌ No admin token found in cookies`);
    }

    // Log the logout event for security audit (if we have valid admin data)
    if (adminData) {
      const logEntry = {
        requestId,
        timestamp: new Date().toISOString(),
        action: 'ADMIN_LOGOUT',
        adminId: adminData.id,
        email: adminData.email,
        role: adminData.role,
        schemaName: adminData.schemaName,
        displayName: adminData.displayName,
        userAgent,
        ipAddress: clientIP
      };
      
      console.log(`[${requestId}] 📋 Security audit log:`, JSON.stringify(logEntry, null, 2));
    }

    console.log(`[${requestId}] 🍪 Preparing to clear all admin cookies...`);

    // Create successful response
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'Admin logged out successfully',
        timestamp: new Date().toISOString()
      } as LogoutResponse,
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );

    // Clear all possible admin token cookie variations
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      expires: new Date(0),
      maxAge: 0
    };

    // Main token variations
    response.cookies.set('adminToken', '', cookieOptions);
    response.cookies.set('admin-token', '', cookieOptions);
    response.cookies.set('admin_token', '', cookieOptions);

    // Refresh token variations
    response.cookies.set('adminRefreshToken', '', cookieOptions);
    response.cookies.set('admin-refresh-token', '', cookieOptions);
    response.cookies.set('admin_refresh_token', '', cookieOptions);

    // Additional possible variations (just in case)
    response.cookies.set('ADMIN_TOKEN', '', cookieOptions);
    response.cookies.set('AdminToken', '', cookieOptions);

    // Clear with different path options to ensure coverage
    const rootPathOptions = { ...cookieOptions, path: '/' };
    const adminPathOptions = { ...cookieOptions, path: '/admin' };
    
    ['adminToken', 'admin-token', 'admin_token'].forEach(cookieName => {
      response.cookies.set(cookieName, '', rootPathOptions);
      response.cookies.set(cookieName, '', adminPathOptions);
    });

    console.log(`[${requestId}] 🗑️  All admin token cookies cleared (multiple variations and paths)`);
    console.log(`[${requestId}] ✅ Admin logout completed successfully`);

    return response;

  } catch (error) {
    console.error(`[${requestId}] 💥 Admin logout error:`, error);
    
    // Even on error, we should clear cookies and allow logout to proceed
    const response = NextResponse.json(
      { 
        success: true, // Return success to allow frontend redirect
        message: 'Logout completed',
        warning: 'Session cleanup may be incomplete',
        timestamp: new Date().toISOString()
      } as LogoutResponse,
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );

    // Force clear cookies even on error - comprehensive clearing
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      expires: new Date(0),
      maxAge: 0
    };

    // Clear all variations
    ['adminToken', 'admin-token', 'admin_token', 'adminRefreshToken', 
     'admin-refresh-token', 'admin_refresh_token'].forEach(cookieName => {
      response.cookies.set(cookieName, '', cookieOptions);
      response.cookies.set(cookieName, '', { ...cookieOptions, path: '/admin' });
    });

    console.log(`[${requestId}] 🗑️  Emergency cookie clearing completed`);
    console.log(`[${requestId}] ⚠️  Logout completed with warnings`);

    return response;
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Method not allowed. Use POST to logout.',
      allowedMethods: ['POST']
    },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Method not allowed. Use POST to logout.',
      allowedMethods: ['POST']
    },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Method not allowed. Use POST to logout.',
      allowedMethods: ['POST']
    },
    { status: 405 }
  );
}

/**
 * Utility function to extract client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  const xClientIP = request.headers.get('x-client-ip');
  const xClusterClientIP = request.headers.get('x-cluster-client-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIP || cfConnectingIP || xClientIP || xClusterClientIP || 'unknown';
}