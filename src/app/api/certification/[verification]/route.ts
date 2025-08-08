// app/api/certification/[verification]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const createPrismaClient = () => new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ verification: string }> }
) {
  const prisma = createPrismaClient();
  
  try {
    const { verification } = await params;
    const verificationCode = verification;

    if (!verificationCode) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    console.log('Looking for verification code:', verificationCode);

    // Since this is a public verification endpoint, we need to search across all tenant schemas
    // First, get all admin schemas
    const admins = await prisma.admin.findMany({
      select: {
        schemaName: true,
        displayName: true
      }
    });

    console.log('Available schemas:', admins.map(a => a.schemaName));

    let certification = null;
    let user = null;
    let foundInSchema = null;

    // Search in each tenant schema
    for (const admin of admins) {
      const { schemaName } = admin;
      
      try {
        console.log(`Searching in schema: ${schemaName}`);
        
        // Set search path to the tenant schema
        await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

        // Try to find the certification in this schema
        const certResult = await prisma.$queryRawUnsafe(
          `SELECT 
            id,
            verification_code,
            batch_ids,
            certification_date,
            total_certified,
            certification_type,
            expiry_date,
            total_jars,
            company_name,
            beekeeper_name,
            location,
            user_id,
            created_at,
            updated_at
          FROM "${schemaName}".certifications 
          WHERE verification_code = $1 
          LIMIT 1`,
          verificationCode
        ) as any[];

        if (certResult && certResult.length > 0) {
          const rawCert = certResult[0];
          console.log(`Found certification in schema: ${schemaName}`, rawCert);
          
          certification = {
            id: rawCert.id,
            verificationCode: rawCert.verification_code,
            batchIds: rawCert.batch_ids,
            certificationDate: rawCert.certification_date,
            totalCertified: rawCert.total_certified,
            certificationType: rawCert.certification_type,
            expiryDate: rawCert.expiry_date,
            totalJars: rawCert.total_jars,
            companyName: rawCert.company_name,
            beekeeperName: rawCert.beekeeper_name,
            location: rawCert.location,
            userId: rawCert.user_id,
            createdAt: rawCert.created_at,
            updatedAt: rawCert.updated_at
          };
          
          foundInSchema = schemaName;

          // Get user information from the same schema
          try {
            const userResult = await prisma.$queryRawUnsafe(
              `SELECT 
                id, firstname, lastname, email, phonenumber, "isProfileComplete"
              FROM "${schemaName}".beeusers 
              WHERE id = $1 
              LIMIT 1`,
              rawCert.user_id
            ) as any[];

            if (userResult && userResult.length > 0) {
              user = userResult[0];
              console.log(`Found user in schema: ${schemaName}`, user);
            }
          } catch (userError) {
            console.log(`Error fetching user from schema ${schemaName}:`, userError);
          }

          break; // Found it, stop searching
        }
      } catch (error) {
        console.log(`Error searching in schema ${schemaName}:`, error);
        continue; // Try next schema
      }
    }

    // Reset search path to public
    await prisma.$executeRawUnsafe(`SET search_path TO public`);

    if (!certification) {
      console.log('No certification found in any schema');
      return NextResponse.json(
        { error: 'Certification not found' },
        { status: 404 }
      );
    }

    console.log(`Certification found in schema: ${foundInSchema}`);

    // Construct beekeeper name
    let beekeeperName = null;
    
    if (user) {
      const { firstname, lastname } = user;
      const validFirstname = firstname && typeof firstname === 'string' && firstname.trim() !== '' && !firstname.includes('undefined');
      const validLastname = lastname && typeof lastname === 'string' && lastname.trim() !== '' && !lastname.includes('undefined');
      
      if (validFirstname || validLastname) {
        const parts = [];
        if (validFirstname) parts.push(firstname.trim());
        if (validLastname) parts.push(lastname.trim());
        beekeeperName = parts.join(' ');
      }
      
      console.log('User info:', { firstname, lastname });
      console.log('Constructed beekeeperName from user:', beekeeperName);
    }

    // Fallback to stored beekeeperName
    if (!beekeeperName && certification.beekeeperName) {
      const storedName = certification.beekeeperName.trim();
      if (storedName && 
          !storedName.includes('undefined') && 
          !storedName.includes('null') &&
          storedName !== 'undefined undefined' &&
          storedName !== 'null null') {
        beekeeperName = storedName;
      }
      
      console.log('Using stored beekeeperName:', beekeeperName);
    }

    if (!beekeeperName) {
      beekeeperName = 'Name not available';
      console.log('Using fallback beekeeper name');
    }

    // Transform the data to match the expected format
    const response = {
      id: certification.id,
      verificationCode: certification.verificationCode,
      batchIds: certification.batchIds,
      certificationDate: certification.certificationDate instanceof Date 
        ? certification.certificationDate.toISOString().split('T')[0]
        : certification.certificationDate,
      totalCertified: parseFloat(certification.totalCertified.toString()),
      certificationType: certification.certificationType,
      expiryDate: certification.expiryDate instanceof Date
        ? certification.expiryDate.toISOString().split('T')[0] 
        : certification.expiryDate,
      totalJars: certification.totalJars,
      companyName: certification.companyName,
      beekeeperName: beekeeperName,
      location: certification.location,
      createdAt: certification.createdAt instanceof Date
        ? certification.createdAt.toISOString()
        : certification.createdAt,
      beekeeperInfo: user ? {
        email: user.email,
        phone: user.phonenumber,
        profileComplete: user.isProfileComplete,
      } : null,
      // Additional debug info (remove in production)
      _debug: {
        foundInSchema: foundInSchema,
        userFound: !!user
      }
    };

    console.log('Sending response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching certification:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // Clean up connection
    try {
      await prisma.$executeRawUnsafe(`SET search_path TO public`);
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}