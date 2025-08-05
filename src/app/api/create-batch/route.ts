import { NextResponse, NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";

// Type definitions to match the actual frontend structure
interface ApiaryObject {
  id: number;
  name: string;
  number: string;
  hiveCount: number;
  kilosCollected: number;
  locationId: number | null;
  location: any;
}

interface BatchRequestBody {
  batchNumber: string;
  batchName?: string;
  apiaries?: ApiaryObject[];
  totalHives?: number;
  totalKg?: number;
}

// GET: Fetch batches for logged-in user
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] GET /api/create-batch - Starting request`);
  
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

    // Fetch batches for the user
    const batches = await prisma.batch.findMany({
      where: { 
        userId: userIdInt
      },
      orderBy: { createdAt: 'desc' },
      include: { apiaries: true },
    });

    // Get token stats if they exist
    const tokenStatsRecord = await prisma.tokenStats.findUnique({
      where: { userId: userIdInt }
    });

    const tokenStats = tokenStatsRecord ? {
      totalTokens: tokenStatsRecord.totalTokens,
      remainingTokens: tokenStatsRecord.remainingTokens,
      originOnly: tokenStatsRecord.originOnly,
      qualityOnly: tokenStatsRecord.qualityOnly,
      bothCertifications: tokenStatsRecord.bothCertifications,
    } : {
      totalTokens: 0,
      remainingTokens: 0,
      originOnly: 0,
      qualityOnly: 0,
      bothCertifications: 0,
    };

    const certifiedHoneyWeight = {
      originOnly: batches.reduce((sum, b) => sum + (b.originOnly || 0), 0),
      qualityOnly: batches.reduce((sum, b) => sum + (b.qualityOnly || 0), 0),
      bothCertifications: batches.reduce((sum, b) => sum + (b.bothCertifications || 0), 0),
    };

    console.log(`✅ [${requestId}] Successfully fetched ${batches.length} batches`);

    return NextResponse.json({
      batches,
      tokenStats,
      certifiedHoneyWeight,
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    return NextResponse.json({ 
      error: 'An error occurred while fetching batches',
      details: error.message 
    }, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] GET request completed`);
  }
}

// POST: Create a new batch
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] POST /api/create-batch - Starting request`);
  
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
    const { batchNumber, batchName, apiaries = [], totalHives, totalKg }: BatchRequestBody = body;

    console.log(`📥 [${requestId}] Request body:`, body);

    // Validate required fields
    if (!batchNumber) {
      return NextResponse.json({ 
        error: 'Batch number is required' 
      }, { status: 400 });
    }

    if (!totalKg || totalKg <= 0) {
      return NextResponse.json({ 
        error: 'Total honey amount (kg) is required and must be greater than 0' 
      }, { status: 400 });
    }

    if (!Array.isArray(apiaries) || apiaries.length === 0) {
      return NextResponse.json({ 
        error: 'At least one apiary is required' 
      }, { status: 400 });
    }

    // Validate each apiary object
    for (const apiary of apiaries) {
      if (!apiary.id || typeof apiary.id !== 'number') {
        return NextResponse.json({ 
          error: 'Each apiary must have a valid id' 
        }, { status: 400 });
      }
      
      // Verify the apiary exists and belongs to the user
      const existingApiary = await prisma.apiary.findFirst({
        where: { 
          id: apiary.id,
          userId: userIdInt
        }
      });
      
      if (!existingApiary) {
        return NextResponse.json({ 
          error: `Apiary with ID ${apiary.id} not found or doesn't belong to user` 
        }, { status: 404 });
      }
    }

    const finalBatchName = batchName?.trim() || `${batchNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

    // Check if batch number already exists for this user
    const existingBatch = await prisma.batch.findFirst({
      where: { 
        batchNumber, 
        userId: userIdInt
      },
    });

    if (existingBatch) {
      return NextResponse.json({ 
        error: 'Batch number already exists' 
      }, { status: 409 });
    }

    console.log(`📦 [${requestId}] Creating batch with number: ${batchNumber}`);

    // STEP 1: Create the batch
    const batch = await prisma.batch.create({
      data: {
        user: { connect: { id: userIdInt } },
        batchNumber,
        batchName: finalBatchName,
        containerType: 'Glass',
        labelType: 'Standard',
        weightKg: totalKg,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        uncertified: 0,
        originOnlyPercent: 0,
        qualityOnlyPercent: 0,
        bothCertificationsPercent: 0,
        uncertifiedPercent: 0,
        completedChecks: 0,
        totalChecks: 4,
      },
    });

    console.log(`📦 [${requestId}] Created batch:`, batch.id);

    // STEP 2: UPDATE existing apiaries with batch ID
    const updatedApiaries = [];

    for (const apiary of apiaries) {
      console.log(`🏠 [${requestId}] Updating apiary with ID:`, apiary.id);
      
      // UPDATE the existing apiary record to link it to the batch
      const updatedApiary = await prisma.apiary.update({
        where: { id: apiary.id },
        data: {
          batchId: batch.id, // Link to the batch
        },
      });
      
      updatedApiaries.push(updatedApiary);
      console.log(`🏠 [${requestId}] Updated apiary:`, updatedApiary.id);
    }

    console.log(`✅ [${requestId}] All ${updatedApiaries.length} apiaries updated successfully`);

    // STEP 3: Return the complete batch with associated apiaries
    const completeBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
      include: { apiaries: true },
    });

    // Get updated list of all batches for the user
    const batches = await prisma.batch.findMany({
      where: { 
        userId: userIdInt
      },
      orderBy: { createdAt: 'desc' },
      include: { apiaries: true },
    });

    console.log(`✅ [${requestId}] Success - returning batch ${batch.batchNumber}`);

    return NextResponse.json({ 
      batch: completeBatch, 
      batchNumber: completeBatch?.batchNumber,
      batches,
      message: `Batch created successfully and ${updatedApiaries.length} existing apiaries updated`
    }, { status: 201 });

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
          error: 'Batch number already exists',
          details: 'Unique constraint violation',
        },
        { status: 409 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to create batch';
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined 
    }, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    console.log(`🏁 [${requestId}] POST request completed`);
  }
}