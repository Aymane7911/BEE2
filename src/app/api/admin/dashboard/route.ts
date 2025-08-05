// app/api/admin/dashboard/route.ts - Schema-per-Tenant Version
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getMasterPrismaClient } from '@/lib/prisma-manager';

interface DashboardData {
  success: boolean;
  error?: string;
  data?: {
    admin: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      schemaName: string;
      displayName: string;
    };
    schema: {
      name: string;
      displayName: string;
      description?: string;
      maxUsers: number;
      maxStorage: number;
    };
    adminUser?: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      isAdmin: boolean;
      isConfirmed: boolean;
      createdAt: Date;
    };
    stats: {
      totalUsers: number;
      totalBatches: number;
      totalCertifications: number;
      totalApiaries: number;
      activeUsers: number;
      pendingUsers: number;
    };
    recentActivity: {
      recentUsers: Array<{
        id: number;
        firstname: string;
        lastname: string;
        email: string;
        createdAt: Date;
        isConfirmed: boolean;
      }>;
      recentBatches: Array<{
        id: string;
        batchNumber: string;
        batchName: string;
        status: string;
        createdAt: Date;
        user: {
          firstname: string;
          lastname: string;
        };
      }>;
      recentCertifications: Array<{
        id: string;
        verificationCode: string;
        certificationType: string;
        totalCertified: string;
        createdAt: Date;
        user: {
          firstname: string;
          lastname: string;
        };
      }>;
    };
  };
}

// Get master database URL with fallback
function getMasterDatabaseUrl(): string {
  const masterUrl = process.env.MASTER_DATABASE_URL || 
                   process.env.DATABASE_URL || 
                   process.env.POSTGRES_URL || 
                   '';
  
  if (!masterUrl || masterUrl.trim() === '') {
    throw new Error('Master database URL is not configured');
  }
  
  return masterUrl;
}

// Create schema-specific Prisma client
function createSchemaPrismaClient(schemaName: string): PrismaClient {
  const baseUrl = getMasterDatabaseUrl();
  const schemaUrl = `${baseUrl}?schema=${schemaName}`;

  return new PrismaClient({
    datasources: {
      db: {
        url: schemaUrl,
      },
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse<DashboardData>> {
  const startTime = Date.now();
  
  try {
    console.log('=== Dashboard API Debug (Schema-per-Tenant) ===');
    
    // Enhanced cookie debugging
    const cookies = request.cookies;
    console.log('Available cookies:', cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })));
    
    // Try multiple cookie names for the admin token
    const adminTokenNames = ['admin-token', 'admin_token', 'adminToken'];
    let adminToken: string | undefined;
    
    for (const tokenName of adminTokenNames) {
      const token = cookies.get(tokenName)?.value;
      if (token) {
        adminToken = token;
        console.log(`Found admin token in cookie: ${tokenName}`);
        break;
      }
    }
    
    // Also check Authorization header
    const authHeader = request.headers.get('authorization');
    if (!adminToken && authHeader?.startsWith('Bearer ')) {
      adminToken = authHeader.substring(7);
      console.log('Found admin token in Authorization header');
    }
    
    if (!adminToken) {
      console.log('No admin token found in any location');
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }
    
    // Verify JWT token manually with better error handling
    let adminSession;
    try {
      const jwt = require('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET;
      
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }
      
      const decoded = jwt.verify(adminToken, jwtSecret) as any;
      
      adminSession = {
        adminId: decoded.adminId,
        email: decoded.email,
        role: decoded.role,
        schemaName: decoded.schemaName || decoded.databaseId // Support both for migration
      };
      
      console.log('JWT decoded successfully:', {
        adminId: adminSession.adminId,
        email: adminSession.email,
        schemaName: adminSession.schemaName,
        hasSchemaName: !!decoded.schemaName,
        hasDatabaseId: !!decoded.databaseId,
        decodedKeys: Object.keys(decoded)
      });
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return NextResponse.json(
        { success: false, error: 'Invalid authentication token. Please log in again.' },
        { status: 401 }
      );
    }
    
    // Validate required session data
    if (!adminSession.adminId) {
      console.log('Missing adminId in session data:', adminSession);
      return NextResponse.json(
        { success: false, error: 'Invalid session data. Please log in again.' },
        { status: 401 }
      );
    }
    
    // Get master database connection
    const masterPrisma = getMasterPrismaClient();
    
    // If schemaName is missing, try to get it from the admin record
    if (!adminSession.schemaName) {
      console.log('Schema name missing from JWT, attempting to retrieve from admin record...');
      
      try {
        const adminRecord = await masterPrisma.admin.findUnique({
          where: { id: adminSession.adminId },
          select: { schemaName: true, isActive: true }
        });
        
        if (!adminRecord || !adminRecord.isActive) {
          console.log('Admin record not found or inactive:', adminSession.adminId);
          return NextResponse.json(
            { success: false, error: 'Admin account not found. Please log in again.' },
            { status: 401 }
          );
        }
        
        if (!adminRecord.schemaName) {
          console.log('Admin record has no schema name:', adminSession.adminId);
          return NextResponse.json(
            { success: false, error: 'Admin account configuration incomplete. Please contact support.' },
            { status: 500 }
          );
        }
        
        adminSession.schemaName = adminRecord.schemaName;
        console.log('Retrieved schema name from admin record:', adminRecord.schemaName);
        
      } catch (error) {
        console.error('Failed to retrieve admin record:', error);
        return NextResponse.json(
          { success: false, error: 'Authentication verification failed. Please log in again.' },
          { status: 401 }
        );
      }
    }
    
    console.log('Verifying admin exists in master database...');
    
    // Test master database connection first
    try {
      await masterPrisma.$queryRaw`SELECT 1`;
      console.log('Master database connection verified');
    } catch (masterDbError) {
      console.error('Master database connection failed:', masterDbError);
      return NextResponse.json(
        { success: false, error: 'Database service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }
    
    // Verify admin exists in master database with timeout
    const adminRecord = await Promise.race([
      masterPrisma.admin.findUnique({
        where: { 
          id: adminSession.adminId,
          isActive: true 
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          role: true,
          schemaName: true,
          displayName: true,
          description: true,
          maxUsers: true,
          maxStorage: true,
          isActive: true,
          createdAt: true
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 15000)
      )
    ]) as any;

    if (!adminRecord) {
      console.log('Admin record not found in master database:', adminSession.adminId);
      return NextResponse.json(
        { success: false, error: 'Admin account not found. Please contact support.' },
        { status: 404 }
      );
    }

    if (!adminRecord.isActive) {
      console.log('Admin account is not active');
      return NextResponse.json(
        { success: false, error: 'Admin account is not active. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify schema name matches
    if (adminRecord.schemaName !== adminSession.schemaName) {
      console.log('Schema name mismatch:', { 
        session: adminSession.schemaName, 
        record: adminRecord.schemaName 
      });
      return NextResponse.json(
        { success: false, error: 'Schema access denied. Please log in again.' },
        { status: 403 }
      );
    }

    console.log('Admin record found in master:', {
      id: adminRecord.id,
      email: adminRecord.email,
      schemaName: adminRecord.schemaName,
      isActive: adminRecord.isActive
    });
    
    // Get schema-specific database connection
    console.log(`Connecting to schema: ${adminRecord.schemaName}...`);
    let schemaPrisma: PrismaClient;
    try {
      schemaPrisma = createSchemaPrismaClient(adminRecord.schemaName);
      await schemaPrisma.$connect();
      console.log('Connected to schema database successfully');
    } catch (connectionError) {
      console.error('Failed to connect to schema database:', connectionError);
      return NextResponse.json(
        { success: false, error: 'Unable to connect to your workspace database. Please try again.' },
        { status: 503 }
      );
    }

    // Test schema database connection
    try {
      await schemaPrisma.$queryRaw`SELECT 1`;
      console.log('Schema database connection verified');
    } catch (testError) {
      console.error('Schema database test query failed:', testError);
      return NextResponse.json(
        { success: false, error: 'Database connection unstable. Please try again.' },
        { status: 503 }
      );
    }

    // Get admin user details from beeusers table (if exists)
    const adminUser = await schemaPrisma.beeusers.findFirst({
      where: {
        email: adminRecord.email,
        isAdmin: true,
        adminId: adminSession.adminId
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        isAdmin: true,
        isConfirmed: true,
        createdAt: true
      }
    }).catch(err => {
      console.log('Admin user not found in beeusers table (this is normal for new admins):', err.message);
      return null;
    });

    console.log('Admin user details:', {
      found: !!adminUser,
      isAdmin: adminUser?.isAdmin,
      isConfirmed: adminUser?.isConfirmed
    });

    // Fetch dashboard statistics with better error handling
    console.log('Fetching dashboard statistics...');
    
    const queries = [
      // Stats queries - No need for databaseId filtering in schema-per-tenant
      () => schemaPrisma.beeusers.count(),
      
      () => schemaPrisma.batch.count(),
      
      () => schemaPrisma.certification.count(),
      
      () => schemaPrisma.apiary.count(),
      
      () => schemaPrisma.beeusers.count({
        where: { isConfirmed: true }
      }),
      
      () => schemaPrisma.beeusers.count({
        where: { isConfirmed: false }
      }),
      
      // Recent activity queries
      () => schemaPrisma.beeusers.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          createdAt: true,
          isConfirmed: true
        }
      }),
      
      () => schemaPrisma.batch.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          batchNumber: true,
          batchName: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              firstname: true,
              lastname: true
            }
          }
        }
      }),
      
      () => schemaPrisma.certification.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          verificationCode: true,
          certificationType: true,
          totalCertified: true,
          createdAt: true,
          user: {
            select: {
              firstname: true,
              lastname: true
            }
          }
        }
      })
    ];

    // Execute queries with individual error handling
    const results = await Promise.allSettled(
      queries.map(async (query, index) => {
        try {
          return await query();
        } catch (error) {
          console.error(`Query ${index} failed:`, error);
          throw error;
        }
      })
    );

    // Extract results with fallbacks
    const extractResult = (result: PromiseSettledResult<any>, fallback: any = 0) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error('Query failed:', result.reason);
        return fallback;
      }
    };

    const [
      totalUsers,
      totalBatches,
      totalCertifications,
      totalApiaries,
      activeUsers,
      pendingUsers,
      recentUsers,
      recentBatches,
      recentCertifications
    ] = results;

    const statsData = {
      totalUsers: extractResult(totalUsers),
      totalBatches: extractResult(totalBatches),
      totalCertifications: extractResult(totalCertifications),
      totalApiaries: extractResult(totalApiaries),
      activeUsers: extractResult(activeUsers),
      pendingUsers: extractResult(pendingUsers)
    };

    const activityData = {
      recentUsers: extractResult(recentUsers, []),
      recentBatches: extractResult(recentBatches, []),
      recentCertifications: extractResult(recentCertifications, []).map((cert: any) => ({
        ...cert,
        totalCertified: cert.totalCertified?.toString() || '0'
      }))
    };

    console.log('Data fetched successfully:', {
      ...statsData,
      recentUsersCount: activityData.recentUsers.length,
      recentBatchesCount: activityData.recentBatches.length,
      recentCertificationsCount: activityData.recentCertifications.length,
      processingTime: Date.now() - startTime
    });

    // Return dashboard data
    const responseData: DashboardData = {
      success: true,
      data: {
        admin: {
          id: adminRecord.id,
          firstname: adminRecord.firstname,
          lastname: adminRecord.lastname,
          email: adminRecord.email,
          role: adminRecord.role,
          schemaName: adminRecord.schemaName,
          displayName: adminRecord.displayName
        },
        schema: {
          name: adminRecord.schemaName,
          displayName: adminRecord.displayName,
          description: adminRecord.description || undefined,
          maxUsers: adminRecord.maxUsers,
          maxStorage: adminRecord.maxStorage
        },
        stats: statsData,
        recentActivity: activityData
      }
    };

    // Add admin user info if available
    if (adminUser) {
      responseData.data!.adminUser = {
        id: adminUser.id,
        firstname: adminUser.firstname,
        lastname: adminUser.lastname,
        email: adminUser.email,
        role: adminUser.role,
        isAdmin: adminUser.isAdmin,
        isConfirmed: adminUser.isConfirmed,
        createdAt: adminUser.createdAt
      };
    }

    console.log('Dashboard API completed successfully in', Date.now() - startTime, 'ms');

    // Clean up schema connection
    await schemaPrisma.$disconnect();

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Dashboard API error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
      });
      
      // Handle Prisma connection errors specifically
      if (error.message.includes('too many clients already') ||
          error.message.includes('connection pool') ||
          error.message.includes('FATAL: sorry, too many clients')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Database connection limit reached. Please try again in a moment.' 
          },
          { status: 503 }
        );
      }
      
      // Handle authentication errors
      if (error.message.includes('jwt') || 
          error.message.includes('token') ||
          error.message.includes('authentication') ||
          error.message.includes('JsonWebTokenError') ||
          error.message.includes('TokenExpiredError')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication failed. Please log in again.' 
          },
          { status: 401 }
        );
      }
      
      // Handle database authentication errors
      if (error.message.includes('authentication failed') ||
          error.message.includes('database credentials') ||
          error.message.includes('not valid')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Database authentication failed. Please contact support.' 
          },
          { status: 503 }
        );
      }
      
      // Handle schema not found errors
      if (error.message.includes('schema') && error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Workspace schema not found. Please contact support.' 
          },
          { status: 404 }
        );
      }
      
      // Handle admin not found errors
      if (error.message.includes('Admin account not found') ||
          error.message.includes('Admin not found in target database')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Admin account not found. Please contact support.' 
          },
          { status: 404 }
        );
      }
      
      // Handle timeout errors
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout. Please try again.' 
          },
          { status: 408 }
        );
      }
      
      // Handle permission errors
      if (error.message.includes('Admin account is not active') ||
          error.message.includes('permission') ||
          error.message.includes('access denied')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Access denied. Your account may be inactive.' 
          },
          { status: 403 }
        );
      }
    }
    
    // Generic error response
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred. Please try again later.' 
      },
      { status: 500 }
    );
    
  } finally {
    // Log final processing time
    console.log('Dashboard API request completed in', Date.now() - startTime, 'ms');
  }
}