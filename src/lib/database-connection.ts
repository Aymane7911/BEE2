// lib/database-connection.ts - Schema-per-Tenant connection management
import { PrismaClient } from '@prisma/client';

// Connection pool configuration
const CONNECTION_CONFIG = {
  PUBLIC_CONNECTION_LIMIT: 5,
  SCHEMA_CONNECTION_LIMIT: 3,
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  IDLE_TIMEOUT: 60000, // 1 minute
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Cache for schema connections with metadata
interface SchemaConnectionInfo {
  client: PrismaClient;
  lastUsed: Date;
  isConnected: boolean;
  retryCount: number;
  schemaName: string;
}

const schemaConnections = new Map<string, SchemaConnectionInfo>();

/**
 * Add connection pool parameters to database URL
 */
function addConnectionPoolParams(databaseUrl: string, connectionLimit: number): string {
  // Return original URL if empty or invalid
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.warn('Database URL is empty, returning as-is');
    return databaseUrl;
  }
  
  try {
    const url = new URL(databaseUrl);
    
    // Add connection pool parameters
    url.searchParams.set('connection_limit', connectionLimit.toString());
    url.searchParams.set('pool_timeout', '10');
    url.searchParams.set('connect_timeout', '30');
    url.searchParams.set('statement_timeout', '30000');
    
    return url.toString();
  } catch (error) {
    console.warn('Failed to parse database URL, using original:', error);
    return databaseUrl;
  }
}

// Get master database URL with fallback
function getMasterDatabaseUrl(): string {
  const masterUrl = process.env.MASTER_DATABASE_URL || 
                   process.env.DATABASE_URL || 
                   process.env.POSTGRES_URL || 
                   '';
  
  if (!masterUrl || masterUrl.trim() === '') {
    console.error('No master database URL found in environment variables');
    console.error('Please set one of: MASTER_DATABASE_URL, DATABASE_URL, or POSTGRES_URL');
    throw new Error('Master database URL is not configured');
  }
  
  return masterUrl;
}

// Public schema database connection (for admin management)
let publicDb: PrismaClient;

try {
  const masterDbUrl = getMasterDatabaseUrl();
  const optimizedMasterUrl = addConnectionPoolParams(masterDbUrl, CONNECTION_CONFIG.PUBLIC_CONNECTION_LIMIT);
  
  publicDb = new PrismaClient({
    datasources: {
      db: {
        url: optimizedMasterUrl,
      },
    },
    log: ['error', 'warn'],
  });
} catch (error) {
  console.error('Failed to initialize public database:', error);
  // Create a dummy client that will fail gracefully
  publicDb = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://localhost:5432/dummy',
      },
    },
    log: ['error'],
  });
}

export { publicDb };

/**
 * Create schema-specific database URL
 */
function createSchemaUrl(baseUrl: string, schemaName: string): string {
  if (!baseUrl || baseUrl.trim() === '') {
    throw new Error('Base database URL cannot be empty');
  }
  
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('schema', schemaName);
    return url.toString();
  } catch (error) {
    // Fallback for non-URL format
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}schema=${schemaName}`;
  }
}

/**
 * Create optimized Prisma client for specific schema
 */
function createSchemaOptimizedPrismaClient(baseUrl: string, schemaName: string): PrismaClient {
  if (!baseUrl || baseUrl.trim() === '') {
    throw new Error('Database URL cannot be empty');
  }
  
  const schemaUrl = createSchemaUrl(baseUrl, schemaName);
  const optimizedUrl = addConnectionPoolParams(schemaUrl, CONNECTION_CONFIG.SCHEMA_CONNECTION_LIMIT);
  
  return new PrismaClient({
    datasources: {
      db: {
        url: optimizedUrl,
      },
    },
    log: ['error'],
  });
}

/**
 * Clean up stale schema connections based on idle timeout
 */
async function cleanupStaleSchemaConnections(): Promise<void> {
  const now = new Date();
  const staleConnections: string[] = [];

  for (const [schemaName, connectionInfo] of schemaConnections.entries()) {
    const idleTime = now.getTime() - connectionInfo.lastUsed.getTime();
    
    if (idleTime > CONNECTION_CONFIG.IDLE_TIMEOUT) {
      staleConnections.push(schemaName);
    }
  }

  // Disconnect stale connections
  for (const schemaName of staleConnections) {
    await disconnectSchema(schemaName);
    console.log(`Cleaned up stale connection for schema: ${schemaName}`);
  }
}

/**
 * Get a Prisma client instance for a specific schema with improved error handling
 */
export async function getSchemaConnection(schemaName: string): Promise<PrismaClient> {
  // Clean up stale connections periodically
  await cleanupStaleSchemaConnections();

  // Check if we have an existing, healthy connection
  const existingConnection = schemaConnections.get(schemaName);
  if (existingConnection?.isConnected) {
    existingConnection.lastUsed = new Date();
    return existingConnection.client;
  }

  // Remove unhealthy connection if it exists
  if (existingConnection && !existingConnection.isConnected) {
    await disconnectSchema(schemaName);
  }

  // Get base URL
  const baseUrl = getMasterDatabaseUrl();

  // Create new connection with retry logic
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
    try {
      const client = createSchemaOptimizedPrismaClient(baseUrl, schemaName);
      
      // Test connection with timeout
      await Promise.race([
        client.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_CONFIG.CONNECTION_TIMEOUT)
        ),
      ]);

      // Cache the successful connection
      schemaConnections.set(schemaName, {
        client,
        lastUsed: new Date(),
        isConnected: true,
        retryCount: 0,
        schemaName,
      });

      console.log(`Successfully connected to schema: ${schemaName}`);
      return client;

    } catch (error: any) {
      lastError = error;
      retryCount++;
      
      if (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
        console.warn(`Connection attempt ${retryCount} failed for schema ${schemaName}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, CONNECTION_CONFIG.RETRY_DELAY * retryCount));
      }
    }
  }

  throw new Error(`Failed to connect to schema ${schemaName} after ${CONNECTION_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Get schema connection from admin session info
 */
export async function getSchemaFromAdminSession(adminSession: {
  schemaName: string;
  adminId: number;
}): Promise<{
  db: PrismaClient;
  adminInfo: {
    id: number;
    schemaName: string;
    displayName: string | null;
    isActive: boolean;
  };
}> {
  console.log('Getting schema connection for admin:', {
    schemaName: adminSession.schemaName,
    adminId: adminSession.adminId
  });

  let admin;
  
  try {
    // Use a timeout for public DB queries to prevent hanging
    admin = await Promise.race([
      publicDb.admin.findUnique({
        where: { id: adminSession.adminId },
        select: {
          id: true,
          schemaName: true,
          displayName: true,
          isActive: true,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Public DB query timeout')), 10000)
      ),
    ]) as any;

  } catch (error: any) {
    console.error(`Public DB query failed for admin ${adminSession.adminId}:`, error);
    throw new Error(`Public database query failed: ${error.message}`);
  }

  if (!admin) {
    throw new Error('Admin not found');
  }

  if (!admin.isActive) {
    throw new Error('Admin account is not active');
  }

  if (admin.schemaName !== adminSession.schemaName) {
    throw new Error('Schema name mismatch');
  }

  // Get tenant schema connection
  const db = await getSchemaConnection(admin.schemaName);

  return {
    db,
    adminInfo: {
      id: admin.id,
      schemaName: admin.schemaName,
      displayName: admin.displayName,
      isActive: admin.isActive,
    },
  };
}

/**
 * Get admin database connection using admin ID
 */
export async function getAdminSchemaConnection(adminId: number): Promise<{
  db: PrismaClient;
  adminInfo: {
    id: number;
    schemaName: string;
    displayName: string | null;
    isActive: boolean;
  };
}> {
  console.log('Getting admin schema connection for admin ID:', adminId);

  let admin;
  
  try {
    // Use timeout for public DB query
    admin = await Promise.race([
      publicDb.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          schemaName: true,
          displayName: true,
          isActive: true,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Public DB query timeout')), 10000)
      ),
    ]) as any;

  } catch (error: any) {
    console.error(`Public DB query failed for admin ${adminId}:`, error);
    throw new Error(`Public database query failed: ${error.message}`);
  }

  if (!admin) {
    throw new Error('Admin not found');
  }

  if (!admin.isActive) {
    throw new Error('Admin account is not active');
  }

  // Get connection to the admin's schema
  const db = await getSchemaConnection(admin.schemaName);

  return {
    db,
    adminInfo: {
      id: admin.id,
      schemaName: admin.schemaName,
      displayName: admin.displayName,
      isActive: admin.isActive,
    },
  };
}

/**
 * Get schema connection by schema name (with admin validation)
 */
export async function getSchemaByName(schemaName: string): Promise<{
  db: PrismaClient;
  adminInfo: {
    id: number;
    schemaName: string;
    displayName: string | null;
    email: string;
  };
}> {
  let admin;
  
  try {
    // Use timeout for public DB query
    admin = await Promise.race([
      publicDb.admin.findUnique({
        where: { schemaName: schemaName },
        select: {
          id: true,
          schemaName: true,
          displayName: true,
          email: true,
          isActive: true,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Public DB query timeout')), 10000)
      ),
    ]) as any;

  } catch (error: any) {
    console.error(`Public DB query failed for schema ${schemaName}:`, error);
    throw new Error(`Public database query failed: ${error.message}`);
  }

  if (!admin) {
    throw new Error('Schema not found');
  }

  if (!admin.isActive) {
    throw new Error('Schema is not active');
  }

  // Get connection to the specific schema
  const db = await getSchemaConnection(admin.schemaName);

  return {
    db,
    adminInfo: {
      id: admin.id,
      schemaName: admin.schemaName,
      displayName: admin.displayName,
      email: admin.email,
    },
  };
}

/**
 * Get all active schemas with timeout protection
 */
export async function getAllActiveSchemas(): Promise<Array<{
  id: number;
  schemaName: string;
  displayName: string | null;
  email: string;
  createdAt: Date;
}>> {
  try {
    const admins = await Promise.race([
      publicDb.admin.findMany({
        where: { isActive: true },
        select: {
          id: true,
          schemaName: true,
          displayName: true,
          email: true,
          createdAt: true,
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Public DB query timeout')), 15000)
      ),
    ]) as any;

    return admins;
  } catch (error: any) {
    console.error('Failed to get active schemas:', error);
    throw new Error(`Failed to retrieve active schemas: ${error.message}`);
  }
}

/**
 * Execute a query across all active schemas with improved error handling
 */
export async function executeAcrossAllSchemas<T>(
  queryFunction: (db: PrismaClient, adminInfo: any) => Promise<T>
): Promise<Array<{ schemaName: string; result: T | null; error?: string }>> {
  const admins = await getAllActiveSchemas();
  const results: Array<{ schemaName: string; result: T | null; error?: string }> = [];

  // Process schemas in batches to avoid overwhelming the connection pool
  const batchSize = 3;
  for (let i = 0; i < admins.length; i += batchSize) {
    const batch = admins.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (admin) => {
      try {
        const db = await getSchemaConnection(admin.schemaName);
        const result = await queryFunction(db, admin);
        return { schemaName: admin.schemaName, result };
      } catch (error: any) {
        console.error(`Error executing query on schema ${admin.schemaName}:`, error);
        return { 
          schemaName: admin.schemaName, 
          result: null, 
          error: error.message 
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Disconnect a specific schema connection
 */
export async function disconnectSchema(schemaName: string): Promise<void> {
  const connectionInfo = schemaConnections.get(schemaName);
  if (connectionInfo) {
    try {
      await connectionInfo.client.$disconnect();
      schemaConnections.delete(schemaName);
      console.log(`Disconnected schema: ${schemaName}`);
    } catch (error) {
      console.error(`Error disconnecting from schema ${schemaName}:`, error);
      // Still remove from cache even if disconnect failed
      schemaConnections.delete(schemaName);
    }
  }
}

/**
 * Clean up all schema connections
 */
export async function disconnectAllSchemas(): Promise<void> {
  console.log('Disconnecting all schema connections...');
  
  // Disconnect public database
  try {
    await publicDb.$disconnect();
    console.log('Public database disconnected');
  } catch (error) {
    console.error('Error disconnecting public database:', error);
  }

  // Disconnect all cached schema connections
  const disconnectPromises = Array.from(schemaConnections.keys()).map(schemaName => 
    disconnectSchema(schemaName)
  );

  await Promise.all(disconnectPromises);
  console.log(`Disconnected ${disconnectPromises.length} tenant schemas`);
}

/**
 * Test schema connection with improved error handling
 */
export async function testSchemaConnection(schemaName: string): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> {
  let testClient: PrismaClient | null = null;
  const startTime = Date.now();
  
  try {
    const baseUrl = getMasterDatabaseUrl();
    testClient = createSchemaOptimizedPrismaClient(baseUrl, schemaName);

    // Test the connection with timeout
    await Promise.race([
      testClient.$queryRaw`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 5000)
      ),
    ]);
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return { 
      success: false, 
      error: error.message,
      responseTime 
    };
  } finally {
    if (testClient) {
      try {
        await testClient.$disconnect();
      } catch (error) {
        console.error('Error disconnecting test client:', error);
      }
    }
  }
}

/**
 * Create a new admin entry in the public database
 */
export async function createAdminEntry(adminInfo: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  role: string;
  schemaName: string;
  displayName?: string;
  description?: string;
  maxUsers?: number;
  maxStorage?: number;
}): Promise<{
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  schemaName: string;
  isActive: boolean;
  createdAt: Date;
}> {
  try {
    // Create the admin record with timeout
    const admin = await Promise.race([
      publicDb.admin.create({
        data: {
          firstname: adminInfo.firstname,
          lastname: adminInfo.lastname,
          email: adminInfo.email,
          password: adminInfo.password,
          role: adminInfo.role,
          schemaName: adminInfo.schemaName,
          displayName: adminInfo.displayName,
          description: adminInfo.description,
          maxUsers: adminInfo.maxUsers,
          maxStorage: adminInfo.maxStorage,
          isActive: true,
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Admin creation timeout')), 10000)
      ),
    ]) as any;

    return admin;
  } catch (error: any) {
    console.error('Failed to create admin:', error);
    throw new Error(`Admin creation failed: ${error.message}`);
  }
}

/**
 * Get connection pool statistics
 */
export function getConnectionPoolStats(): {
  totalConnections: number;
  activeSchemas: string[];
  connectionDetails: Array<{
    schemaName: string;
    lastUsed: Date;
    isConnected: boolean;
    retryCount: number;
  }>;
} {
  const connectionDetails = Array.from(schemaConnections.entries()).map(([schema, info]) => ({
    schemaName: schema,
    lastUsed: info.lastUsed,
    isConnected: info.isConnected,
    retryCount: info.retryCount,
  }));

  return {
    totalConnections: schemaConnections.size,
    activeSchemas: Array.from(schemaConnections.keys()),
    connectionDetails,
  };
}

/**
 * Force cleanup of all connections (emergency use)
 */
export async function forceCleanupConnections(): Promise<void> {
  console.log('Force cleaning up all connections...');
  
  // Clear the connections map first to prevent new connections
  const schemaNames = Array.from(schemaConnections.keys());
  schemaConnections.clear();
  
  // Try to disconnect each connection
  for (const schemaName of schemaNames) {
    try {
      const connectionInfo = schemaConnections.get(schemaName);
      if (connectionInfo) {
        await connectionInfo.client.$disconnect();
      }
    } catch (error) {
      console.error(`Error force disconnecting ${schemaName}:`, error);
    }
  }
  
  console.log(`Force cleaned up ${schemaNames.length} connections`);
}

/**
 * Utility function to get admin by email
 */
export async function getAdminByEmail(email: string): Promise<{
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  role: string;
  schemaName: string;
  isActive: boolean;
} | null> {
  try {
    const admin = await Promise.race([
      publicDb.admin.findUnique({
        where: { email: email },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          password: true,
          role: true,
          schemaName: true,
          isActive: true,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Public DB query timeout')), 10000)
      ),
    ]) as any;

    return admin;
  } catch (error: any) {
    console.error(`Failed to get admin by email ${email}:`, error);
    throw new Error(`Failed to get admin: ${error.message}`);
  }
}

// Enhanced graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await Promise.race([
      disconnectAllSchemas(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
      ),
    ]);
    console.log('Graceful shutdown completed');
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    await forceCleanupConnections();
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Periodic cleanup of stale connections (every 5 minutes)
setInterval(async () => {
  try {
    await cleanupStaleSchemaConnections();
  } catch (error) {
    console.error('Error during periodic cleanup:', error);
  }
}, 5 * 60 * 1000);

export default {
  publicDb,
  getSchemaConnection,
  getSchemaFromAdminSession,
  getAdminSchemaConnection,
  getSchemaByName,
  getAllActiveSchemas,
  executeAcrossAllSchemas,
  disconnectSchema,
  disconnectAllSchemas,
  testSchemaConnection,
  createAdminEntry,
  getConnectionPoolStats,
  forceCleanupConnections,
  getAdminByEmail,
};