import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";

// ======================= 
// ✅ POST: Add tokens to user's balance
// ======================= 
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] POST /api/token-stats/add-tokens - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    
    // Get the authenticated user data
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

    // Verify user exists in the tenant schema
    const userInSchema = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { 
        id: true, 
        email: true, 
        isAdmin: true,
        isPremium: true,
        firstname: true,
        lastname: true 
      }
    });

    if (!userInSchema) {
      console.error(`[${requestId}] ▶ User not found in schema:`, schemaName);
      return NextResponse.json(
        { error: "User not found in tenant schema. Please contact support." },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] ▶ Using user:`, userInSchema.email);

    const body = await request.json();
    console.log(`📥 [${requestId}] Request body:`, body);

    const { tokensToAdd, targetUserId, reason } = body;

    // Parse and validate tokens to add
    const tokensToAddInt = parseInt(String(tokensToAdd || 0), 10);
    if (tokensToAddInt <= 0) {
      console.log(`❌ [${requestId}] Invalid tokens amount: ${tokensToAddInt}`);
      return NextResponse.json({ 
        error: "Tokens to add must be greater than 0",
        provided: tokensToAddInt 
      }, { status: 400 });
    }

    // Determine target user (self or another user if admin)
    let finalTargetUserId = userIdInt;
    let targetUser: typeof userInSchema = userInSchema;

    if (targetUserId && targetUserId !== userIdInt) {
      // Adding tokens to another user - requires admin privileges
      if (!userInSchema.isAdmin) {
        console.log(`❌ [${requestId}] Non-admin user trying to add tokens to another user`);
        return NextResponse.json({ 
          error: "Admin privileges required to add tokens to other users" 
        }, { status: 403 });
      }

      finalTargetUserId = parseInt(String(targetUserId));
      if (isNaN(finalTargetUserId)) {
        return NextResponse.json(
          { error: "Invalid target user ID" },
          { status: 400 }
        );
      }

      // Verify target user exists - FIXED: Include isAdmin in select
      const foundTargetUser = await prisma.beeusers.findUnique({
        where: { id: finalTargetUserId },
        select: { 
          id: true, 
          email: true, 
          isPremium: true,
          isAdmin: true,      // ✅ Added this field
          firstname: true,
          lastname: true 
        }
      });

      if (!foundTargetUser) {
        console.error(`[${requestId}] ▶ Target user not found:`, finalTargetUserId);
        return NextResponse.json(
          { error: "Target user not found in tenant schema" },
          { status: 404 }
        );
      }

      targetUser = foundTargetUser;
    }

    console.log(`📊 [${requestId}] Adding ${tokensToAddInt} tokens to user ${finalTargetUserId} (${targetUser.email})`);
    if (reason) {
      console.log(`📝 [${requestId}] Reason: ${reason}`);
    }

    // Find or create tokenStats (no databaseId needed in schema-per-tenant)
    let tokenStats = await prisma.tokenStats.findUnique({ 
      where: { 
        userId: finalTargetUserId
      } 
    });
    
    if (tokenStats) {
      tokenStats = await prisma.tokenStats.update({
        where: { 
          userId: finalTargetUserId
        },
        data: {
          totalTokens: tokenStats.totalTokens + tokensToAddInt,
          remainingTokens: tokenStats.remainingTokens + tokensToAddInt,
        },
      });
      console.log(`📊 [${requestId}] Updated existing stats: Total=${tokenStats.totalTokens}, Remaining=${tokenStats.remainingTokens}`);
    } else {
      // Create new token stats for the user
      tokenStats = await prisma.tokenStats.create({
        data: {
          userId: finalTargetUserId,
          totalTokens: tokensToAddInt,
          remainingTokens: tokensToAddInt,
          originOnly: 0,
          qualityOnly: 0,
          bothCertifications: 0,
        },
      });
      console.log(`📊 [${requestId}] Created new stats:`, tokenStats);
    }

    // Auto-correct remaining tokens if mismatch
    const usedTokens = tokenStats.originOnly + tokenStats.qualityOnly + tokenStats.bothCertifications;
    const expectedRemaining = tokenStats.totalTokens - usedTokens;
    if (expectedRemaining !== tokenStats.remainingTokens) {
      console.warn(`⚠️ [${requestId}] Remaining mismatch: expected=${expectedRemaining}, actual=${tokenStats.remainingTokens}`);
      tokenStats = await prisma.tokenStats.update({
        where: { 
          userId: finalTargetUserId
        },
        data: { remainingTokens: expectedRemaining },
      });
      console.log(`🔧 [${requestId}] Corrected remaining to ${expectedRemaining}`);
    }

    const finalStats = {
      ...tokenStats,
      usedTokens
    };

    console.log(`✅ [${requestId}] Final stats:`, finalStats);
    
    const responseMessage = finalTargetUserId === userIdInt 
      ? `Successfully added ${tokensToAddInt} tokens to your account`
      : `Successfully added ${tokensToAddInt} tokens to ${targetUser.email}'s account`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      addedTokens: tokensToAddInt,
      reason: reason || null,
      tokenStats: finalStats,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.firstname} ${targetUser.lastname}`,
        isPremium: targetUser.isPremium,
        isAdmin: targetUser.isAdmin    // ✅ Now this field is available
      },
      performedBy: {
        id: userInSchema.id,
        email: userInSchema.email,
        name: `${userInSchema.firstname} ${userInSchema.lastname}`,
        isAdmin: userInSchema.isAdmin
      }
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    // Handle Prisma foreign key constraint errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Database reference error. Please contact support.',
          details: 'Foreign key constraint violation',
        },
        { status: 400 }
      );
    }

    // Handle unique constraint violations
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Token stats already exist for this user',
          details: 'Unique constraint violation',
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to add tokens", 
        details: error.message 
      }, 
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] Request completed`);
  }
}

// ======================= 
// ✅ GET: Get current token balance for user or admin view
// ======================= 
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] GET /api/token-stats/add-tokens - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
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

    // Get user info
    const userInSchema = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { 
        id: true, 
        email: true, 
        isAdmin: true,
        isPremium: true,
        firstname: true,
        lastname: true 
      }
    });

    if (!userInSchema) {
      return NextResponse.json(
        { error: "User not found in tenant schema" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    let finalTargetUserId = userIdInt;
    let targetUser: typeof userInSchema = userInSchema;

    // If requesting another user's data, check admin privileges
    if (targetUserId && parseInt(targetUserId) !== userIdInt) {
      if (!userInSchema.isAdmin) {
        return NextResponse.json({ 
          error: "Admin privileges required to view other users' token stats" 
        }, { status: 403 });
      }

      finalTargetUserId = parseInt(targetUserId);
      if (isNaN(finalTargetUserId)) {
        return NextResponse.json(
          { error: "Invalid target user ID" },
          { status: 400 }
        );
      }

      // FIXED: Include isAdmin in select
      const foundTargetUser = await prisma.beeusers.findUnique({
        where: { id: finalTargetUserId },
        select: { 
          id: true, 
          email: true, 
          isPremium: true,
          isAdmin: true,      // ✅ Added this field
          firstname: true,
          lastname: true 
        }
      });

      if (!foundTargetUser) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 }
        );
      }

      targetUser = foundTargetUser;
    }

    // Get token stats
    const tokenStats = await prisma.tokenStats.findUnique({
      where: { userId: finalTargetUserId }
    });

    if (!tokenStats) {
      return NextResponse.json({
        userId: finalTargetUserId,
        totalTokens: 0,
        remainingTokens: 0,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        usedTokens: 0,
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          name: `${targetUser.firstname} ${targetUser.lastname}`,
          isPremium: targetUser.isPremium,
          isAdmin: targetUser.isAdmin    // ✅ Now this field is available
        }
      });
    }

    const usedTokens = tokenStats.originOnly + tokenStats.qualityOnly + tokenStats.bothCertifications;

    return NextResponse.json({
      id: tokenStats.id,
      userId: tokenStats.userId,
      totalTokens: tokenStats.totalTokens,
      remainingTokens: tokenStats.remainingTokens,
      originOnly: tokenStats.originOnly,
      qualityOnly: tokenStats.qualityOnly,
      bothCertifications: tokenStats.bothCertifications,
      usedTokens: usedTokens,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.firstname} ${targetUser.lastname}`,
        isPremium: targetUser.isPremium,
        isAdmin: targetUser.isAdmin    // ✅ Now this field is available
      }
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch token stats", 
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

// ======================= 
// ✅ DELETE: Remove tokens from user's balance (Admin only)
// ======================= 
export async function DELETE(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] DELETE /api/token-stats/add-tokens - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
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

    // Verify user is admin
    const userInSchema = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { 
        id: true, 
        email: true, 
        isAdmin: true,
        firstname: true,
        lastname: true 
      }
    });

    if (!userInSchema || !userInSchema.isAdmin) {
      return NextResponse.json({ 
        error: "Admin privileges required" 
      }, { status: 403 });
    }

    const body = await request.json();
    const { tokensToRemove, targetUserId, reason } = body;

    const tokensToRemoveInt = parseInt(String(tokensToRemove || 0), 10);
    if (tokensToRemoveInt <= 0) {
      return NextResponse.json({ 
        error: "Tokens to remove must be greater than 0" 
      }, { status: 400 });
    }

    const finalTargetUserId = parseInt(String(targetUserId || userIdInt));
    if (isNaN(finalTargetUserId)) {
      return NextResponse.json(
        { error: "Invalid target user ID" },
        { status: 400 }
      );
    }

    // Verify target user exists - FIXED: Include both isPremium and isAdmin
    const foundTargetUser = await prisma.beeusers.findUnique({
      where: { id: finalTargetUserId },
      select: { 
        id: true, 
        email: true, 
        isPremium: true,    // ✅ Added this field
        isAdmin: true,      // ✅ Added this field
        firstname: true,
        lastname: true 
      }
    });

    if (!foundTargetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const targetUser = foundTargetUser;

    // Get current token stats
    const currentStats = await prisma.tokenStats.findUnique({
      where: { userId: finalTargetUserId }
    });

    if (!currentStats) {
      return NextResponse.json(
        { error: "User has no token stats to modify" },
        { status: 404 }
      );
    }

    // Calculate new balances
    const newTotalTokens = Math.max(0, currentStats.totalTokens - tokensToRemoveInt);
    const newRemainingTokens = Math.max(0, currentStats.remainingTokens - tokensToRemoveInt);

    // Update token stats
    const updatedStats = await prisma.tokenStats.update({
      where: { userId: finalTargetUserId },
      data: {
        totalTokens: newTotalTokens,
        remainingTokens: newRemainingTokens,
      },
    });

    const usedTokens = updatedStats.originOnly + updatedStats.qualityOnly + updatedStats.bothCertifications;

    console.log(`✅ [${requestId}] Removed ${tokensToRemoveInt} tokens from user ${targetUser.email}`);

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${tokensToRemoveInt} tokens from ${targetUser.email}'s account`,
      removedTokens: tokensToRemoveInt,
      reason: reason || null,
      tokenStats: {
        ...updatedStats,
        usedTokens
      },
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.firstname} ${targetUser.lastname}`,
        isPremium: targetUser.isPremium,   // ✅ Now this field is available
        isAdmin: targetUser.isAdmin        // ✅ Now this field is available
      },
      performedBy: {
        id: userInSchema.id,
        email: userInSchema.email,
        name: `${userInSchema.firstname} ${userInSchema.lastname}`,
        isAdmin: userInSchema.isAdmin
      }
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    return NextResponse.json(
      { 
        error: "Failed to remove tokens", 
        details: error.message 
      }, 
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] DELETE request completed`);
  }
}