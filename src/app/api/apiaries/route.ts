// src/app/api/apiaries/route.ts - Adapted for schema-per-tenant architecture
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";

interface LocationData {
  latitude: string | number;
  longitude: string | number;
}

interface CreateApiaryBody {
  name: string;
  number: string;
  hiveCount?: string | number;
  location?: LocationData; // Made optional since you're also sending individual coords
  latitude?: string | number; // Direct coordinates
  longitude?: string | number; // Direct coordinates
  honeyCollected?: string | number; // Mapped to kilosCollected in DB
  kilosCollected?: string | number; // Direct field
  locationName?: string; // Added locationName field
  batchId?: string; // For linking to batches
}

// GET handler – return all apiaries
export async function GET(request: NextRequest) {
  let prisma: PrismaClient | null = null;

  try {
    // Get the authenticated user data
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.warn('[GET /api/apiaries] ▶ No authenticated user found');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and schemaName from the auth result
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log('[GET /api/apiaries] ▶ Authenticated user ID:', userId, 'Schema:', schemaName);

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

    console.log('[GET /api/apiaries] ▶ Using schema:', schemaName);

    // Verify user exists in the tenant schema
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

    if (!userInSchema) {
      console.error('[GET /api/apiaries] ▶ User not found in schema:', schemaName);
      return NextResponse.json(
        { error: "User not found in tenant schema. Please contact support." },
        { status: 404 }
      );
    }

    console.log('[GET /api/apiaries] ▶ Using user:', userInSchema.email);

    // Fetch all apiaries for the user in their schema
    // In schema-per-tenant, we don't need databaseId filtering since data is already isolated
    const apiaries = await prisma.apiary.findMany({
      where: {
        userId: userIdInt,
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            batchName: true,
            status: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[GET /api/apiaries] ▶ Found ${apiaries.length} apiaries in schema ${schemaName}`);

    return NextResponse.json(apiaries);

  } catch (error) {
    console.error('Error in GET /api/apiaries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// POST handler – create a new apiary
export async function POST(request: NextRequest) {
  let prisma: PrismaClient | null = null;

  try {
    // Get the authenticated user data
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and schemaName from the auth result
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log('[POST /api/apiaries] ▶ Authenticated user ID:', userId, 'Schema:', schemaName);

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

    console.log('[POST /api/apiaries] ▶ Using schema:', schemaName);

    // Verify user exists in the tenant schema
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

    if (!userInSchema) {
      console.error('[POST /api/apiaries] ▶ User not found in schema:', schemaName);
      return NextResponse.json(
        { error: "User not found in tenant schema. Please contact support." },
        { status: 404 }
      );
    }

    console.log('[POST /api/apiaries] ▶ Using user:', userInSchema.email);

    const body: CreateApiaryBody = await request.json();
    console.log('[POST /api/apiaries] ▶ Request body:', body);

    const { 
      name, 
      number, 
      hiveCount, 
      location, 
      latitude, 
      longitude, 
      honeyCollected, 
      kilosCollected,
      locationName,
      batchId 
    } = body;

    // Validate required fields
    if (!name || !number) {
      return NextResponse.json(
        { message: 'Name and number are required' },
        { status: 400 }
      );
    }

    // Extract coordinates - support both formats
    let lat: number, lng: number;
    
    if (location && location.latitude && location.longitude) {
      // Format 1: location object
      lat = parseFloat(String(location.latitude));
      lng = parseFloat(String(location.longitude));
    } else if (latitude && longitude) {
      // Format 2: direct latitude/longitude fields
      lat = parseFloat(String(latitude));
      lng = parseFloat(String(longitude));
    } else {
      return NextResponse.json(
        { message: 'Location coordinates (latitude and longitude) are required' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { message: 'Invalid latitude or longitude values' },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90) {
      return NextResponse.json(
        { message: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (lng < -180 || lng > 180) {
      return NextResponse.json(
        { message: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Check if an apiary with the same number already exists in this schema
    // In schema-per-tenant, we only need to check within the user's data
    const existingApiary = await prisma.apiary.findFirst({
      where: { 
        number,
        userId: userIdInt,
      },
    });
    
    if (existingApiary) {
      return NextResponse.json(
        { message: 'An apiary with this number already exists' },
        { status: 409 } // Conflict
      );
    }

    // Validate batchId if provided
    if (batchId) {
      const batch = await prisma.batch.findFirst({
        where: {
          id: batchId,
          userId: userIdInt,
        }
      });

      if (!batch) {
        return NextResponse.json(
          { message: 'Invalid batch ID or batch does not belong to user' },
          { status: 400 }
        );
      }
    }

    // Process locationName - handle null/empty strings properly
    let processedLocationName: string | null = null;
    if (locationName && typeof locationName === 'string') {
      const trimmed = locationName.trim();
      if (trimmed.length > 0) {
        processedLocationName = trimmed;
      }
    }

    // Determine kilos collected - priority: kilosCollected, then honeyCollected
    const finalKilosCollected = parseFloat(String(kilosCollected || honeyCollected)) || 0;

    console.log('[POST /api/apiaries] ▶ Creating apiary with data:', {
      name: name.trim(),
      number: number.trim(),
      hiveCount: parseInt(String(hiveCount)) || 0,
      latitude: lat,
      longitude: lng,
      locationName: processedLocationName,
      kilosCollected: Math.max(0, finalKilosCollected),
      userId: userIdInt,
      batchId: batchId || null,
    });

    // Create the new apiary
    const newApiary = await prisma.apiary.create({
      data: {
        name: name.trim(),
        number: number.trim(),
        hiveCount: parseInt(String(hiveCount)) || 0,
        latitude: lat,
        longitude: lng,
        locationName: processedLocationName,
        kilosCollected: Math.max(0, finalKilosCollected),
        userId: userIdInt,
        batchId: batchId || null, // Optional batch association
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            batchName: true,
            status: true,
          }
        }
      }
    });

    console.log('[POST /api/apiaries] ▶ Created new apiary:', newApiary.id, 'in schema:', schemaName);

    return NextResponse.json(newApiary, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/apiaries:', error);
    
    // More specific error handling
    if (error instanceof Error && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        {
          message: 'Database reference error. Invalid batch ID or user reference.',
          error: 'Foreign key constraint violation',
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        {
          message: 'An apiary with this number already exists',
          error: 'Unique constraint violation',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// PUT handler - Update an existing apiary
export async function PUT(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const apiaryId = searchParams.get('id');

    if (!apiaryId) {
      return NextResponse.json(
        { error: 'Apiary ID is required' },
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

    // Verify apiary exists and belongs to user
    const existingApiary = await prisma.apiary.findFirst({
      where: { 
        id: parseInt(apiaryId),
        userId: userIdInt,
      },
    });

    if (!existingApiary) {
      return NextResponse.json(
        { error: 'Apiary not found or access denied' },
        { status: 404 }
      );
    }

    const body: CreateApiaryBody = await request.json();
    const { 
      name, 
      number, 
      hiveCount, 
      location, 
      latitude, 
      longitude, 
      honeyCollected, 
      kilosCollected,
      locationName,
      batchId 
    } = body;

    // Build update data object
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (number !== undefined) updateData.number = number.trim();
    if (hiveCount !== undefined) updateData.hiveCount = parseInt(String(hiveCount)) || 0;
    if (locationName !== undefined) {
      updateData.locationName = locationName?.trim() || null;
    }
    if (batchId !== undefined) updateData.batchId = batchId || null;

    // Handle coordinates
    if (location?.latitude && location?.longitude) {
      updateData.latitude = parseFloat(String(location.latitude));
      updateData.longitude = parseFloat(String(location.longitude));
    } else if (latitude !== undefined && longitude !== undefined) {
      updateData.latitude = parseFloat(String(latitude));
      updateData.longitude = parseFloat(String(longitude));
    }

    // Handle kilos collected
    if (kilosCollected !== undefined || honeyCollected !== undefined) {
      updateData.kilosCollected = Math.max(0, parseFloat(String(kilosCollected || honeyCollected)) || 0);
    }

    // Validate coordinates if being updated
    if (updateData.latitude !== undefined || updateData.longitude !== undefined) {
      const lat = updateData.latitude;
      const lng = updateData.longitude;
      
      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
          { message: 'Invalid latitude or longitude values' },
          { status: 400 }
        );
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          { message: 'Coordinates out of valid range' },
          { status: 400 }
        );
      }
    }

    // Validate batch if being updated
    if (updateData.batchId) {
      const batch = await prisma.batch.findFirst({
        where: {
          id: updateData.batchId,
          userId: userIdInt,
        }
      });

      if (!batch) {
        return NextResponse.json(
          { message: 'Invalid batch ID or batch does not belong to user' },
          { status: 400 }
        );
      }
    }

    // Update the apiary
    const updatedApiary = await prisma.apiary.update({
      where: { id: parseInt(apiaryId) },
      data: updateData,
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            batchName: true,
            status: true,
          }
        }
      }
    });

    console.log('[PUT /api/apiaries] ▶ Updated apiary:', apiaryId, 'in schema:', schemaName);
    return NextResponse.json(updatedApiary, { status: 200 });

  } catch (error) {
    console.error('Error in PUT /api/apiaries:', error);
    return NextResponse.json(
      { error: 'Failed to update apiary' },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// DELETE handler - Delete an apiary
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const apiaryId = searchParams.get('id');

    if (!apiaryId) {
      return NextResponse.json(
        { error: 'Apiary ID is required' },
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

    // Verify apiary exists and belongs to user
    const existingApiary = await prisma.apiary.findFirst({
      where: { 
        id: parseInt(apiaryId),
        userId: userIdInt,
      },
    });

    if (!existingApiary) {
      return NextResponse.json(
        { error: 'Apiary not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the apiary
    await prisma.apiary.delete({
      where: { id: parseInt(apiaryId) },
    });

    console.log('[DELETE /api/apiaries] ▶ Deleted apiary:', apiaryId, 'in schema:', schemaName);
    return NextResponse.json(
      { message: 'Apiary deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in DELETE /api/apiaries:', error);
    return NextResponse.json(
      { error: 'Failed to delete apiary' },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}