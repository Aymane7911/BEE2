// app/api/certification/store/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Create a new Prisma instance for each request to avoid connection issues
const createPrismaClient = () => new PrismaClient();

export async function POST(request: NextRequest) {
  const prisma = createPrismaClient();
  
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
    let userId: number | undefined;
    let email: string;
    let schemaName: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      console.log('[certification/store] Decoded JWT payload:', decoded);
      
      // Handle both admin tokens and user tokens
      userId = decoded.userId || decoded.id || decoded.adminId;
      email = decoded.email;
      schemaName = decoded.schemaName; // Schema name should be included in JWT
            
      if (!schemaName) {
        console.log('[certification/store] Schema information missing from token');
        return NextResponse.json(
          { error: 'Schema information missing from token' },
          { status: 401 }
        );
      }

      if (!email) {
        console.log('[certification/store] Email information missing from token');
        return NextResponse.json(
          { error: 'Email information missing from token' },
          { status: 401 }
        );
      }
      
      console.log('[certification/store] Extracted from token - userId:', userId, 'email:', email, 'schemaName:', schemaName, 'role:', decoded.role);
    } catch (error) {
      console.log('[certification/store] JWT verification error:', error);
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

    // Validate required fields
    if (!verificationCode || !batchIds || !certificationDate || !totalCertified || !certificationType || !expiryDate || !totalJars) {
      return NextResponse.json(
        { error: 'Missing required certification data' },
        { status: 400 }
      );
    }

    // Connect to the specific schema using raw connection
    console.log('[certification/store] Connecting to schema:', schemaName);
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

    // Check if verification code already exists within this schema
    console.log('[certification/store] Checking for existing verification code:', verificationCode);
    const existingCert = await prisma.certification.findUnique({
      where: {
        verificationCode: verificationCode
      }
    });

    if (existingCert) {
      console.log('[certification/store] Verification code already exists');
      return NextResponse.json(
        { error: 'Verification code already exists' },
        { status: 409 }
      );
    }

    // Find user by email in the current schema context
    console.log('[certification/store] Looking for user by email:', email);
    
    // Use raw query to ensure we're in the right schema context
    const userResult = await prisma.$queryRawUnsafe(
      `SELECT id, email, firstname, lastname FROM "${schemaName}".beeusers WHERE email = $1 LIMIT 1`,
      email
    ) as any[];

    console.log('[certification/store] Raw query result:', userResult);

    if (!userResult || userResult.length === 0) {
      console.log('[certification/store] User not found in schema:', schemaName);
      
      // Debug: show all users in schema
      try {
        const allUsers = await prisma.$queryRawUnsafe(
          `SELECT id, email, firstname, lastname FROM "${schemaName}".beeusers LIMIT 5`
        ) as any[];
        console.log('[certification/store] All users in schema:', allUsers);
      } catch (debugError) {
        console.log('[certification/store] Error querying all users:', debugError);
      }
      
      return NextResponse.json(
        { error: 'User not found in this context' },
        { status: 404 }
      );
    }

    const user = userResult[0];
    const actualUserId = parseInt(user.id);
    console.log('[certification/store] Found user:', { id: actualUserId, email: user.email });

    // Format dates properly for PostgreSQL
    const formatDateForPG = (dateString: string): string => {
      // Handle different date formats and ensure YYYY-MM-DD format
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateString}`);
      }
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    };

    const formattedCertDate = formatDateForPG(certificationDate);
    const formattedExpiryDate = formatDateForPG(expiryDate);

    console.log('[certification/store] Formatted dates - certification:', formattedCertDate, 'expiry:', formattedExpiryDate);

    // Create new certification record in the tenant schema using raw query
    console.log('[certification/store] Creating certification...');
    
    const certResult = await prisma.$queryRawUnsafe(
      `INSERT INTO "${schemaName}".certifications (
        id, verification_code, batch_ids, certification_date, total_certified, 
        certification_type, expiry_date, total_jars, company_name, 
        beekeeper_name, location, user_id, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3::date, $4, $5, $6::date, $7, $8, $9, $10, $11, NOW(), NOW()
      ) RETURNING id, verification_code`,
      verificationCode,
      batchIds,
      formattedCertDate,        // Now properly formatted as YYYY-MM-DD string
      parseFloat(totalCertified.toString()),
      certificationType,
      formattedExpiryDate,      // Now properly formatted as YYYY-MM-DD string
      parseInt(totalJars.toString()),
      companyName,
      beekeeperName,
      location,
      actualUserId
    ) as any[];

    const certification = certResult[0];
    console.log('[certification/store] Certification created successfully:', certification);

    return NextResponse.json({
      success: true,
      certification: {
        id: certification.id,
        verificationCode: certification.verification_code,
        message: 'Certification stored successfully'
      }
    });

  } catch (error) {
    console.error('[certification/store] Error storing certification:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('[certification/store] Error message:', error.message);
      console.error('[certification/store] Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Clean up connection
    try {
      await prisma.$executeRawUnsafe(`SET search_path TO public`);
      await prisma.$disconnect();
    } catch (error) {
      console.error('[certification/store] Error during cleanup:', error);
    }
  }
}