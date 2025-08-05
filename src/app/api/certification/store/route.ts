// app/api/certification/store/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token and extract user info
    let userId: number;
    let schemaName: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      userId = decoded.userId || decoded.id;
      schemaName = decoded.schemaName; // Schema name should be included in JWT
      
      if (!schemaName) {
        return NextResponse.json(
          { error: 'Schema information missing from token' },
          { status: 401 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    const {
      verificationCode,
      batchIds,
      certificationDate,
      totalCertified,
      certificationType,
      expiryDate,
      totalJars,
      companyName,
      beekeeperName,
      location
    } = body;

    // Validate required fields (removed databaseId)
    if (!verificationCode || !batchIds || !certificationDate || !totalCertified || !certificationType || !expiryDate || !totalJars) {
      return NextResponse.json(
        { error: 'Missing required certification data' },
        { status: 400 }
      );
    }

    // Set the schema for this request
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

    // Check if verification code already exists within this schema
    const existingCert = await prisma.certification.findUnique({
      where: {
        verificationCode: verificationCode
      }
    });

    if (existingCert) {
      return NextResponse.json(
        { error: 'Verification code already exists' },
        { status: 409 }
      );
    }

    // Verify user exists in this schema (optional security check)
    const user = await prisma.beeusers.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in this context' },
        { status: 404 }
      );
    }

    // Create new certification record in the tenant schema
    const certification = await prisma.certification.create({
      data: {
        verificationCode,
        batchIds,
        certificationDate: new Date(certificationDate),
        totalCertified: parseFloat(totalCertified.toString()),
        certificationType,
        expiryDate: new Date(expiryDate),
        totalJars: parseInt(totalJars.toString()),
        companyName,
        beekeeperName,
        location,
        userId: userId
      }
    });

    return NextResponse.json({
      success: true,
      certification: {
        id: certification.id,
        verificationCode: certification.verificationCode,
        message: 'Certification stored successfully'
      }
    });

  } catch (error) {
    console.error('Error storing certification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Reset search_path to default (optional)
    await prisma.$executeRawUnsafe(`SET search_path TO public`);
    await prisma.$disconnect();
  }
}