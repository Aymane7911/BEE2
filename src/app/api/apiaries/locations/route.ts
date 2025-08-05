// app/api/apiaries/locations/route.ts - Adapted for schema-per-tenant architecture
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from "@/lib/auth";

// GET - Fetch saved location templates (no batchId)
export async function GET(request: NextRequest) {
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);
    console.log('Auth result:', authResult);
    
    // Handle if authenticateRequest returns an object instead of just userId
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log('Extracted userId:', userId, 'Schema:', schemaName, 'Type:', typeof userId);
    
    if (!userId || !schemaName) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userIdInt = parseInt(String(userId));
    console.log('Parsed userId:', userIdInt);
    
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

    // Verify user exists in the tenant schema
    const user = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { id: true, isAdmin: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in tenant schema' },
        { status: 404 }
      );
    }

    // Fetch ONLY saved locations (no batchId) - these are location templates
    // In schema-per-tenant, we only need userId since each tenant has isolated data
    const locations = await prisma.apiary.findMany({
      where: {
        userId: userIdInt,
        batchId: null, // Only saved location templates
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        locationName: true, // Added from new schema
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Fetched ${locations.length} saved locations for user ${userIdInt} in schema ${schemaName}`);
    return NextResponse.json(locations, { status: 200 });

  } catch (error) {
    console.error('Error fetching saved locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved locations' },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// POST - Save a location template (no batchId)
export async function POST(request: NextRequest) {
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);
    console.log('Auth result:', authResult);
    
    // Handle if authenticateRequest returns an object instead of just userId
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log('Extracted userId:', userId, 'Schema:', schemaName, 'Type:', typeof userId);

    if (!userId || !schemaName) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userIdInt = parseInt(String(userId));
    console.log('Parsed userId:', userIdInt);
    
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { latitude, longitude, name, locationName } = body;

    // Validate required fields
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
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

    // Verify user exists in the tenant schema
    const user = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { id: true, isAdmin: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in tenant schema' },
        { status: 404 }
      );
    }

    // Create location template (no batchId)
    const newLocation = await prisma.apiary.create({
      data: {
        name: name?.trim() || `Saved Location ${new Date().toLocaleDateString()}`,
        number: `LOC_${Date.now()}`, // unique identifier within schema
        latitude: parseFloat(String(latitude)),
        longitude: parseFloat(String(longitude)),
        locationName: locationName?.trim() || null, // Optional location name
        hiveCount: 0,
        kilosCollected: 0,
        userId: userIdInt,
        // batchId is intentionally omitted (will be null by default)
      },
    });

    console.log(`Created new location template: ${newLocation.id} in schema ${schemaName}`);
    return NextResponse.json(newLocation, { status: 201 });

  } catch (error) {
    console.error('Error saving location template:', error);
    return NextResponse.json(
      { error: 'Failed to save location template', details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// DELETE - Remove a saved location template
export async function DELETE(request: NextRequest) {
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);
    console.log('Auth result:', authResult);
    
    // Handle if authenticateRequest returns an object instead of just userId
    const userId = typeof authResult === 'object' && authResult !== null ? authResult.userId : authResult;
    const schemaName = typeof authResult === 'object' && authResult !== null ? authResult.schemaName : null;
    
    console.log('Extracted userId:', userId, 'Schema:', schemaName, 'Type:', typeof userId);
    
    if (!userId || !schemaName) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userIdInt = parseInt(String(userId));
    console.log('Parsed userId:', userIdInt);
    
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Location ID is required' },
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

    // Verify user exists in the tenant schema
    const user = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { id: true, isAdmin: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in tenant schema' },
        { status: 404 }
      );
    }

    // Only allow deleting saved location templates (no batchId) that belong to this user
    // In schema-per-tenant, data is already isolated by schema, so we only need userId check
    const location = await prisma.apiary.findFirst({
      where: { 
        id: parseInt(id),
        userId: userIdInt,
        batchId: null // Only allow deleting location templates, not actual apiaries
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location template not found or access denied' },
        { status: 404 }
      );
    }

    await prisma.apiary.delete({
      where: { id: parseInt(id) },
    });

    console.log(`Deleted location template ${id} for user ${userIdInt} in schema ${schemaName}`);
    return NextResponse.json(
      { message: 'Location template deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting location template:', error);
    return NextResponse.json(
      { error: 'Failed to delete location template' },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// PATCH - Update a saved location template
export async function PATCH(request: NextRequest) {
  let prisma: PrismaClient | null = null;

  try {
    const authResult = await authenticateRequest(request);
    console.log('Auth result:', authResult);
    
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { latitude, longitude, name, locationName } = body;

    // Validate coordinates if provided
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
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

    // Verify location exists and belongs to user
    const existingLocation = await prisma.apiary.findFirst({
      where: { 
        id: parseInt(id),
        userId: userIdInt,
        batchId: null // Only location templates
      },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location template not found or access denied' },
        { status: 404 }
      );
    }

    // Build update data object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (locationName !== undefined) updateData.locationName = locationName?.trim() || null;
    if (latitude !== undefined) updateData.latitude = parseFloat(String(latitude));
    if (longitude !== undefined) updateData.longitude = parseFloat(String(longitude));

    // Update the location template
    const updatedLocation = await prisma.apiary.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    console.log(`Updated location template ${id} for user ${userIdInt} in schema ${schemaName}`);
    return NextResponse.json(updatedLocation, { status: 200 });

  } catch (error) {
    console.error('Error updating location template:', error);
    return NextResponse.json(
      { error: 'Failed to update location template' },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}