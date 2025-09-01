import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";

// =======================
// ✅ GET: Fetch token stats
// =======================
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] GET /api/token-stats/update - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    const authResult = await authenticateRequest(request);

    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Extract userId and schemaName from the auth result
    const userId = authResult.userId;
    const schemaName = authResult.schemaName;
    
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

    // Fetch token stats for the user (no databaseId needed in schema-per-tenant)
    const tokenStats = await prisma.tokenStats.findUnique({
      where: { 
        userId: userIdInt
      }
    });

    if (!tokenStats) {
      console.log(`📊 [${requestId}] No token stats found, returning defaults`);
      return NextResponse.json({
        userId: userIdInt,
        totalTokens: 0,
        remainingTokens: 0,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        usedTokens: 0,
        userInfo: {
          email: userInSchema.email,
          isPremium: userInSchema.isPremium,
          name: `${userInSchema.firstname} ${userInSchema.lastname}`
        }
      });
    }

    const usedTokens = tokenStats.originOnly + tokenStats.qualityOnly + tokenStats.bothCertifications;
    const expectedRemaining = tokenStats.totalTokens - usedTokens;

    if (expectedRemaining !== tokenStats.remainingTokens) {
      console.warn(`⚠️ [${requestId}] Mismatch: expectedRemaining = ${expectedRemaining}, actual = ${tokenStats.remainingTokens}`);
      
      // Auto-correct the remaining tokens if there's a mismatch
      await prisma.tokenStats.update({
        where: { userId: userIdInt },
        data: {
          remainingTokens: expectedRemaining
        }
      });
      
      console.log(`🔧 [${requestId}] Auto-corrected remaining tokens to: ${expectedRemaining}`);
    }

    console.log(`✅ [${requestId}] GET completed`);
    return NextResponse.json({
      id: tokenStats.id,
      userId: tokenStats.userId,
      totalTokens: tokenStats.totalTokens,
      remainingTokens: expectedRemaining,
      originOnly: tokenStats.originOnly,
      qualityOnly: tokenStats.qualityOnly,
      bothCertifications: tokenStats.bothCertifications,
      usedTokens: usedTokens,
      userInfo: {
        email: userInSchema.email,
        isPremium: userInSchema.isPremium,
        name: `${userInSchema.firstname} ${userInSchema.lastname}`
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] FATAL GET ERROR:`, error);
    
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
    
    return NextResponse.json(
      { error: "Failed to fetch token stats", details: (error as Error).message },
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
// ✅ POST: Update token stats using actual token balance
// =======================
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] POST /api/token-stats/update - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    const authResult = await authenticateRequest(request);

    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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
    console.log(`📥 [${requestId}] Raw body:`, body);

    const { originOnly, qualityOnly, bothCertifications, tokensUsed, totalTokens } = body;

    const originOnlyInt = parseInt(String(originOnly || 0), 10) || 0;
    const qualityOnlyInt = parseInt(String(qualityOnly || 0), 10) || 0;
    const bothCertificationsInt = parseInt(String(bothCertifications || 0), 10) || 0;
    const tokensUsedInt = parseInt(String(tokensUsed || 0), 10) || 0;
    const totalTokensInt = parseInt(String(totalTokens || 0), 10) || 0;

    const safeOriginOnly = Math.max(0, originOnlyInt);
    const safeQualityOnly = Math.max(0, qualityOnlyInt);
    const safeBothCertifications = Math.max(0, bothCertificationsInt);
    const safeTokensUsed = Math.max(0, tokensUsedInt);

    console.log(`📊 [${requestId}] Token breakdown validated: OriginOnly=${safeOriginOnly}, QualityOnly=${safeQualityOnly}, Both=${safeBothCertifications}, Total=${safeTokensUsed}`);
    
    // Get current token stats (no databaseId needed in schema-per-tenant)
    const existingStats = await prisma.tokenStats.findUnique({
      where: { 
        userId: userIdInt
      }
    });

    let updatedTokenStats;

    if (existingStats) {
      const currentRemainingTokens = existingStats.remainingTokens;
      
      // Check if user has enough tokens for this certification
      if (currentRemainingTokens < safeTokensUsed) {
        console.log(`❌ [${requestId}] Insufficient tokens: available=${currentRemainingTokens}, needed=${safeTokensUsed}`);
        return NextResponse.json(
          { 
            error: `Insufficient tokens. Available: ${currentRemainingTokens}, Needed: ${safeTokensUsed}`,
            availableTokens: currentRemainingTokens,
            requiredTokens: safeTokensUsed 
          },
          { status: 400 }
        );
      }

      // Update stats and deduct tokens from remaining balance
      updatedTokenStats = await prisma.tokenStats.update({
        where: { 
          userId: userIdInt
        },
        data: {
          originOnly: existingStats.originOnly + safeOriginOnly,
          qualityOnly: existingStats.qualityOnly + safeQualityOnly,
          bothCertifications: existingStats.bothCertifications + safeBothCertifications,
          remainingTokens: currentRemainingTokens - safeTokensUsed
        }
      });

      console.log(`📊 [${requestId}] Updated existing stats: 
        Origin: ${existingStats.originOnly} + ${safeOriginOnly} = ${updatedTokenStats.originOnly}
        Quality: ${existingStats.qualityOnly} + ${safeQualityOnly} = ${updatedTokenStats.qualityOnly}
        Both: ${existingStats.bothCertifications} + ${safeBothCertifications} = ${updatedTokenStats.bothCertifications}
        Remaining: ${currentRemainingTokens} - ${safeTokensUsed} = ${updatedTokenStats.remainingTokens}`);

    } else {
      // For new users, determine their token balance based on premium status or provided totalTokens
      let actualTokenBalance = totalTokensInt;
      
      if (!actualTokenBalance) {
        // Set default token balance based on user status
        actualTokenBalance = userInSchema.isPremium ? 5000 : 2299; // Premium users get more tokens
      }
      
      if (actualTokenBalance < safeTokensUsed) {
        console.log(`❌ [${requestId}] Insufficient tokens for new user: available=${actualTokenBalance}, needed=${safeTokensUsed}`);
        return NextResponse.json(
          { 
            error: `Insufficient tokens. Available: ${actualTokenBalance}, Needed: ${safeTokensUsed}`,
            availableTokens: actualTokenBalance,
            requiredTokens: safeTokensUsed 
          },
          { status: 400 }
        );
      }

      // Create new stats with actual token balance
      updatedTokenStats = await prisma.tokenStats.create({
        data: {
          userId: userIdInt,
          totalTokens: actualTokenBalance,
          remainingTokens: actualTokenBalance - safeTokensUsed,
          originOnly: safeOriginOnly,
          qualityOnly: safeQualityOnly,
          bothCertifications: safeBothCertifications
        }
      });

      console.log(`📊 [${requestId}] Created new stats for user with token balance: ${actualTokenBalance}, remaining: ${updatedTokenStats.remainingTokens}`);
    }

    // Verification: Check if the math adds up
    const usedTokens = updatedTokenStats.originOnly + updatedTokenStats.qualityOnly + updatedTokenStats.bothCertifications;
    const expectedRemaining = updatedTokenStats.totalTokens - usedTokens;

    if (expectedRemaining !== updatedTokenStats.remainingTokens) {
      console.warn(`⚠️ [${requestId}] Post-update mismatch: expected=${expectedRemaining}, actual=${updatedTokenStats.remainingTokens}`);
      
      // Auto-correct the remaining tokens if there's a mismatch
      updatedTokenStats = await prisma.tokenStats.update({
        where: { userId: userIdInt },
        data: {
          remainingTokens: expectedRemaining
        }
      });
      
      console.log(`🔧 [${requestId}] Auto-corrected remaining tokens to: ${expectedRemaining}`);
    }

    console.log(`✅ [${requestId}] POST completed successfully - Final stats:`, {
      originOnly: updatedTokenStats.originOnly,
      qualityOnly: updatedTokenStats.qualityOnly,
      bothCertifications: updatedTokenStats.bothCertifications,
      totalUsed: usedTokens,
      remainingTokens: updatedTokenStats.remainingTokens,
      totalTokens: updatedTokenStats.totalTokens
    });

    return NextResponse.json({
      id: updatedTokenStats.id,
      userId: updatedTokenStats.userId,
      totalTokens: updatedTokenStats.totalTokens,
      remainingTokens: updatedTokenStats.remainingTokens,
      originOnly: updatedTokenStats.originOnly,
      qualityOnly: updatedTokenStats.qualityOnly,
      bothCertifications: updatedTokenStats.bothCertifications,
      usedTokens: usedTokens,
      userInfo: {
        email: userInSchema.email,
        isPremium: userInSchema.isPremium,
        name: `${userInSchema.firstname} ${userInSchema.lastname}`
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] FATAL POST ERROR:`, error);
    
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
      { error: "Failed to update token stats", details: (error as Error).message }, 
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] POST request completed`);
  }
}

// =======================
// ✅ PUT: Reset or set token balance (Admin function)
// =======================
export async function PUT(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] PUT /api/token-stats/update - Starting request`);
  
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);

    if (!authResult) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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

    // Verify user exists and has admin privileges
    const userInSchema = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { 
        id: true, 
        email: true, 
        isAdmin: true,
        isPremium: true 
      }
    });

    if (!userInSchema) {
      return NextResponse.json(
        { error: "User not found in tenant schema" },
        { status: 404 }
      );
    }

    if (!userInSchema.isAdmin) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, totalTokens, resetUsage } = body;

    const targetUserIdInt = parseInt(String(targetUserId || userIdInt));
    const newTotalTokens = parseInt(String(totalTokens || 0));

    if (isNaN(targetUserIdInt) || isNaN(newTotalTokens) || newTotalTokens < 0) {
      return NextResponse.json(
        { error: "Invalid input parameters" },
        { status: 400 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.beeusers.findUnique({
      where: { id: targetUserIdInt },
      select: { id: true, email: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Update or create token stats
    const updatedStats = await prisma.tokenStats.upsert({
      where: { userId: targetUserIdInt },
      update: {
        totalTokens: newTotalTokens,
        remainingTokens: resetUsage ? newTotalTokens : newTotalTokens,
        ...(resetUsage && {
          originOnly: 0,
          qualityOnly: 0,
          bothCertifications: 0
        })
      },
      create: {
        userId: targetUserIdInt,
        totalTokens: newTotalTokens,
        remainingTokens: newTotalTokens,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0
      }
    });

    console.log(`✅ [${requestId}] PUT completed - ${resetUsage ? 'Reset' : 'Updated'} token balance for user ${targetUser.email}`);

    return NextResponse.json({
      message: `Token balance ${resetUsage ? 'reset' : 'updated'} successfully`,
      stats: updatedStats,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] FATAL PUT ERROR:`, error);
    
    return NextResponse.json(
      { error: "Failed to update token balance", details: (error as Error).message }, 
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] PUT request completed`);
  }
}