import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";

// PATCH - Update user premium status (requires authentication)
export async function PATCH(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] PATCH /api/user/premium - Starting request`);
  
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
    const { isPremium } = body;

    console.log(`📥 [${requestId}] Request body:`, { isPremium });

    if (typeof isPremium !== 'boolean') {
      console.log(`❌ [${requestId}] Invalid isPremium value:`, isPremium);
      return NextResponse.json({ 
        error: 'Invalid premium status. Must be true or false.' 
      }, { status: 400 });
    }

    // Verify user exists first
    const existingUser = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { 
        id: true, 
        email: true,
        isPremium: true,
        premiumStartedAt: true,
        premiumExpiresAt: true
      }
    });

    if (!existingUser) {
      console.error(`[${requestId}] ▶ User not found:`, userIdInt);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`🔄 [${requestId}] Updating premium status for:`, existingUser.email);
    console.log(`[${requestId}] ▶ Current isPremium:`, existingUser.isPremium, '→ New:', isPremium);

    // Calculate premium dates
    const premiumStartedAt = isPremium ? (existingUser.premiumStartedAt || new Date()) : null;
    const premiumExpiresAt = isPremium ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null; // 1 year from now

    // Update user premium status
    const updatedUser = await prisma.beeusers.update({
      where: { id: userIdInt },
      data: { 
        isPremium: isPremium,
        premiumStartedAt: premiumStartedAt,
        premiumExpiresAt: premiumExpiresAt
      },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        isPremium: true,
        isAdmin: true,
        premiumStartedAt: true,
        premiumExpiresAt: true
      }
    });

    console.log(`✅ [${requestId}] Successfully updated premium status for:`, updatedUser.email);

    return NextResponse.json({
      success: true,
      message: `Premium status ${isPremium ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    // Handle Prisma specific errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Unique constraint violation',
          details: 'Database constraint error',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ 
      error: 'Failed to update premium status',
      details: error.message 
    }, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] PATCH request completed`);
  }
}

// GET - Get user premium status (requires authentication)
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] GET /api/user/premium - Starting request`);
  
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

    // Get user premium status
    const user = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        isPremium: true,
        isAdmin: true,
        premiumStartedAt: true,
        premiumExpiresAt: true,
        createdAt: true
      }
    });

    if (!user) {
      console.error(`[${requestId}] ▶ User not found:`, userIdInt);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`✅ [${requestId}] Successfully fetched premium status for:`, user.email);

    // Check if premium has expired
    const now = new Date();
    const isPremiumActive = user.isPremium && 
                           (!user.premiumExpiresAt || user.premiumExpiresAt > now);

    // If premium has expired, update the database
    if (user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt <= now) {
      console.log(`⏰ [${requestId}] Premium expired for user:`, user.email);
      
      const expiredUser = await prisma.beeusers.update({
        where: { id: userIdInt },
        data: { 
          isPremium: false,
          premiumExpiresAt: null
        },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
          isPremium: true,
          isAdmin: true,
          premiumStartedAt: true,
          premiumExpiresAt: true,
          createdAt: true
        }
      });

      return NextResponse.json({
        success: true,
        user: expiredUser,
        message: 'Premium subscription has expired'
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        isPremiumActive: isPremiumActive
      }
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    return NextResponse.json({ 
      error: 'Failed to fetch premium status',
      details: error.message 
    }, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] GET request completed`);
  }
}