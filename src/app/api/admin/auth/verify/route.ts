// app/api/admin/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

interface VerifyResponse {
  success: boolean;
  token?: string;
  admin?: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
    schemaName: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  try {
    // Get the admin token from httpOnly cookie (same as your login sets)
    const adminToken = request.cookies.get('admin-token')?.value;
    
    if (!adminToken) {
      return NextResponse.json<VerifyResponse>(
        { success: false, error: 'No authentication token found' },
        { status: 401 }
      );
    }

    // Verify the JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json<VerifyResponse>(
        { success: false, error: 'JWT configuration error' },
        { status: 500 }
      );
    }

    try {
      const decoded = jwt.verify(adminToken, jwtSecret) as any;
      
      // Verify it's an admin token
      if (!decoded.adminId || !decoded.role || !decoded.schemaName) {
        return NextResponse.json<VerifyResponse>(
          { success: false, error: 'Invalid admin token' },
          { status: 401 }
        );
      }

      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        return NextResponse.json<VerifyResponse>(
          { success: false, error: 'Token expired' },
          { status: 401 }
        );
      }

      // Return the token and admin info for localStorage
      return NextResponse.json<VerifyResponse>({
        success: true,
        token: adminToken, // Return the same token for localStorage
        admin: {
          id: decoded.adminId,
          firstname: decoded.firstname || 'Admin',
          lastname: decoded.lastname || 'User',
          email: decoded.email,
          role: decoded.role,
          schemaName: decoded.schemaName,
        }
      });

    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return NextResponse.json<VerifyResponse>(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json<VerifyResponse>(
      { success: false, error: 'Authentication verification failed' },
      { status: 500 }
    );
  }
}

// Handle other methods
export async function GET(): Promise<NextResponse<VerifyResponse>> {
  return NextResponse.json<VerifyResponse>(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}