// src/lib/prisma-manager.ts - Adapted for Schema-per-Tenant Architecture
import { PrismaClient } from '@prisma/client';

// Connection pool configuration
const CONNECTION_CONFIG = {
  PUBLIC_CONNECTION_LIMIT: 5,
  SCHEMA_CONNECTION_LIMIT: 3,
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  IDLE_TIMEOUT: 60000, // 1 minute
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  BATCH_SIZE: 3, // For parallel operations
};

// Schema connection info interface
interface SchemaConnectionInfo {
  client: PrismaClient;
  lastUsed: Date;
  isConnected: boolean;
  retryCount: number;
  schemaName: string;
  adminId: number;
}

// Global connection pools
const schemaClients = new Map<string, SchemaConnectionInfo>();
let masterPrisma: PrismaClient | null = null;

/**
 * Add connection pool parameters to database URL
 */
function addConnectionPoolParams(databaseUrl: string, connectionLimit: number): string {
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.warn('[PrismaManager] Database URL is empty, returning as-is');
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
    console.warn('[PrismaManager] Failed to parse database URL, using original:', error);
    return databaseUrl;
  }
}

/**
 * Get master database URL with fallback
 */
function getMasterDatabaseUrl(): string {
  const masterUrl = process.env.MASTER_DATABASE_URL || 
                   process.env.DATABASE_URL || 
                   process.env.POSTGRES_URL || 
                   '';
  
  if (!masterUrl || masterUrl.trim() === '') {
    console.error('[PrismaManager] No master database URL found in environment variables');
    console.error('[PrismaManager] Please set one of: MASTER_DATABASE_URL, DATABASE_URL, or POSTGRES_URL');
    throw new Error('Master database URL is not configured');
  }
  
  return masterUrl;
}

/**
 * Get the master Prisma client (for public schema - admin management)
 */
function getMasterPrismaClient(): PrismaClient {
  if (masterPrisma) return masterPrisma;

  try {
    const masterDbUrl = getMasterDatabaseUrl();
    const optimizedMasterUrl = addConnectionPoolParams(masterDbUrl, CONNECTION_CONFIG.PUBLIC_CONNECTION_LIMIT);
    
    console.log('[PrismaManager] Creating master database client');
    masterPrisma = new PrismaClient({
      datasources: { 
        db: { 
          url: optimizedMasterUrl 
        } 
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    return masterPrisma;
  } catch (error) {
    console.error('[PrismaManager] Failed to initialize master database:', error);
    throw new Error(`Master database initialization failed: ${error}`);
  }
}

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

  for (const [schemaName, connectionInfo] of schemaClients.entries()) {
    const idleTime = now.getTime() - connectionInfo.lastUsed.getTime();
    
    if (idleTime > CONNECTION_CONFIG.IDLE_TIMEOUT) {
      staleConnections.push(schemaName);
    }
  }

  // Disconnect stale connections
  for (const schemaName of staleConnections) {
    await disconnectSchemaClient(schemaName);
    console.log(`[PrismaManager] Cleaned up stale connection for schema: ${schemaName}`);
  }
}

/**
 * Get admin info from master database
 */
export async function getAdminInfo(adminId: number): Promise<{
  id: number;
  schemaName: string;
  displayName: string | null;
  isActive: boolean;
} | null> {
  const masterPrisma = getMasterPrismaClient();
  
  try {
    const admin = await Promise.race([
      masterPrisma.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          schemaName: true,
          displayName: true,
          isActive: true,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Admin query timeout')), 10000)
      ),
    ]) as any;

    return admin;
  } catch (error: any) {
    console.error(`[PrismaManager] Error fetching admin info for ID ${adminId}:`, error);
    throw new Error(`Failed to get admin info: ${error.message}`);
  }
}

/**
 * Get admin info by schema name
 */
export async function getAdminInfoBySchema(schemaName: string): Promise<{
  id: number;
  schemaName: string;
  displayName: string | null;
  email: string;
  isActive: boolean;
} | null> {
  const masterPrisma = getMasterPrismaClient();
  
  try {
    const admin = await Promise.race([
      masterPrisma.admin.findUnique({
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
        setTimeout(() => reject(new Error('Admin query timeout')), 10000)
      ),
    ]) as any;

    return admin;
  } catch (error: any) {
    console.error(`[PrismaManager] Error fetching admin info for schema ${schemaName}:`, error);
    throw new Error(`Failed to get admin info by schema: ${error.message}`);
  }
}

/**
 * Get a Prisma client instance for a specific schema by admin ID
 */
export async function getPrismaClientByAdminId(adminId: number): Promise<{
  client: PrismaClient;
  adminInfo: {
    id: number;
    schemaName: string;
    displayName: string | null;
    isActive: boolean;
  };
} | null> {
  console.log(`[PrismaManager] Getting Prisma client for admin ID: ${adminId}`);
  
  // Clean up stale connections periodically
  await cleanupStaleSchemaConnections();

  // Get admin info first
  const adminInfo = await getAdminInfo(adminId);
  if (!adminInfo) {
    console.error(`[PrismaManager] Admin not found for ID: ${adminId}`);
    return null;
  }

  if (!adminInfo.isActive) {
    console.error(`[PrismaManager] Admin account is not active for ID: ${adminId}`);
    return null;
  }

  // Check if we have an existing, healthy connection
  const existingConnection = schemaClients.get(adminInfo.schemaName);
  if (existingConnection?.isConnected && existingConnection.adminId === adminId) {
    existingConnection.lastUsed = new Date();
    console.log(`[PrismaManager] Reusing existing connection for schema: ${adminInfo.schemaName}`);
    return {
      client: existingConnection.client,
      adminInfo
    };
  }

  // Remove unhealthy connection if it exists
  if (existingConnection && !existingConnection.isConnected) {
    await disconnectSchemaClient(adminInfo.schemaName);
  }

  // Create new connection with retry logic
  const baseUrl = getMasterDatabaseUrl();
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
    try {
      const client = createSchemaOptimizedPrismaClient(baseUrl, adminInfo.schemaName);
      
      // Test connection with timeout
      await Promise.race([
        client.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_CONFIG.CONNECTION_TIMEOUT)
        ),
      ]);

      // Cache the successful connection
      schemaClients.set(adminInfo.schemaName, {
        client,
        lastUsed: new Date(),
        isConnected: true,
        retryCount: 0,
        schemaName: adminInfo.schemaName,
        adminId: adminId,
      });

      console.log(`[PrismaManager] Successfully connected to schema: ${adminInfo.schemaName}`);
      return {
        client,
        adminInfo
      };

    } catch (error: any) {
      lastError = error;
      retryCount++;
      
      if (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
        console.warn(`[PrismaManager] Connection attempt ${retryCount} failed for schema ${adminInfo.schemaName}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, CONNECTION_CONFIG.RETRY_DELAY * retryCount));
      }
    }
  }

  throw new Error(`Failed to connect to schema ${adminInfo.schemaName} after ${CONNECTION_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Get a Prisma client instance for a specific schema by schema name
 */
export async function getPrismaClientBySchemaName(schemaName: string): Promise<{
  client: PrismaClient;
  adminInfo: {
    id: number;
    schemaName: string;
    displayName: string | null;
    email: string;
    isActive: boolean;
  };
} | null> {
  console.log(`[PrismaManager] Getting Prisma client for schema: ${schemaName}`);
  
  // Clean up stale connections periodically
  await cleanupStaleSchemaConnections();

  // Get admin info first
  const adminInfo = await getAdminInfoBySchema(schemaName);
  if (!adminInfo) {
    console.error(`[PrismaManager] Schema not found: ${schemaName}`);
    return null;
  }

  if (!adminInfo.isActive) {
    console.error(`[PrismaManager] Schema is not active: ${schemaName}`);
    return null;
  }

  // Check if we have an existing, healthy connection
  const existingConnection = schemaClients.get(schemaName);
  if (existingConnection?.isConnected) {
    existingConnection.lastUsed = new Date();
    console.log(`[PrismaManager] Reusing existing connection for schema: ${schemaName}`);
    return {
      client: existingConnection.client,
      adminInfo
    };
  }

  // Remove unhealthy connection if it exists
  if (existingConnection && !existingConnection.isConnected) {
    await disconnectSchemaClient(schemaName);
  }

  // Create new connection with retry logic
  const baseUrl = getMasterDatabaseUrl();
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
      schemaClients.set(schemaName, {
        client,
        lastUsed: new Date(),
        isConnected: true,
        retryCount: 0,
        schemaName: schemaName,
        adminId: adminInfo.id,
      });

      console.log(`[PrismaManager] Successfully connected to schema: ${schemaName}`);
      return {
        client,
        adminInfo
      };

    } catch (error: any) {
      lastError = error;
      retryCount++;
      
      if (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
        console.warn(`[PrismaManager] Connection attempt ${retryCount} failed for schema ${schemaName}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, CONNECTION_CONFIG.RETRY_DELAY * retryCount));
      }
    }
  }

  throw new Error(`Failed to connect to schema ${schemaName} after ${CONNECTION_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
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
  const masterPrisma = getMasterPrismaClient();
  
  try {
    const admins = await Promise.race([
      masterPrisma.admin.findMany({
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
    console.error('[PrismaManager] Failed to get active schemas:', error);
    throw new Error(`Failed to retrieve active schemas: ${error.message}`);
  }
}

/**
 * Execute a query across all active schemas with improved error handling
 */
export async function executeAcrossAllSchemas<T>(
  queryFunction: (client: PrismaClient, adminInfo: any) => Promise<T>
): Promise<Array<{ schemaName: string; result: T | null; error?: string }>> {
  const admins = await getAllActiveSchemas();
  const results: Array<{ schemaName: string; result: T | null; error?: string }> = [];

  // Process schemas in batches to avoid overwhelming the connection pool
  for (let i = 0; i < admins.length; i += CONNECTION_CONFIG.BATCH_SIZE) {
    const batch = admins.slice(i, i + CONNECTION_CONFIG.BATCH_SIZE);
    
    const batchPromises = batch.map(async (admin) => {
      try {
        const result = await getPrismaClientBySchemaName(admin.schemaName);
        if (!result) {
          throw new Error('Failed to get schema client');
        }
        
        const queryResult = await queryFunction(result.client, admin);
        return { schemaName: admin.schemaName, result: queryResult };
      } catch (error: any) {
        console.error(`[PrismaManager] Error executing query on schema ${admin.schemaName}:`, error);
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
 * Disconnect a specific schema client
 */
export async function disconnectSchemaClient(schemaName: string): Promise<void> {
  const connectionInfo = schemaClients.get(schemaName);
  if (connectionInfo) {
    try {
      await connectionInfo.client.$disconnect();
      schemaClients.delete(schemaName);
      console.log(`[PrismaManager] Disconnected schema: ${schemaName}`);
    } catch (error) {
      console.error(`[PrismaManager] Error disconnecting from schema ${schemaName}:`, error);
      // Still remove from cache even if disconnect failed
      schemaClients.delete(schemaName);
    }
  }
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
        console.error('[PrismaManager] Error disconnecting test client:', error);
      }
    }
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
    adminId: number;
  }>;
} {
  const connectionDetails = Array.from(schemaClients.entries()).map(([schema, info]) => ({
    schemaName: schema,
    lastUsed: info.lastUsed,
    isConnected: info.isConnected,
    retryCount: info.retryCount,
    adminId: info.adminId,
  }));

  return {
    totalConnections: schemaClients.size,
    activeSchemas: Array.from(schemaClients.keys()),
    connectionDetails,
  };
}

/**
 * Cleanup function for graceful shutdown
 */
export async function disconnectAllClients(): Promise<void> {
  console.log('[PrismaManager] Disconnecting all clients...');
  
  // Disconnect master client
  const masterDisconnectPromise = masterPrisma ? 
    masterPrisma.$disconnect().catch(error => {
      console.error('[PrismaManager] Error disconnecting master client:', error);
    }) : Promise.resolve();

  // Disconnect all schema clients
  const schemaDisconnectPromises = Array.from(schemaClients.keys()).map(schemaName => 
    disconnectSchemaClient(schemaName)
  );

  await Promise.all([masterDisconnectPromise, ...schemaDisconnectPromises]);
  
  schemaClients.clear();
  masterPrisma = null;
  
  console.log('[PrismaManager] All clients disconnected');
}

/**
 * Force cleanup of all connections (emergency use)
 */
export async function forceCleanupConnections(): Promise<void> {
  console.log('[PrismaManager] Force cleaning up all connections...');
  
  // Clear the connections map first to prevent new connections
  const schemaNames = Array.from(schemaClients.keys());
  schemaClients.clear();
  
  // Try to disconnect each connection
  for (const schemaName of schemaNames) {
    try {
      const connectionInfo = schemaClients.get(schemaName);
      if (connectionInfo) {
        await connectionInfo.client.$disconnect();
      }
    } catch (error) {
      console.error(`[PrismaManager] Error force disconnecting ${schemaName}:`, error);
    }
  }

  // Force disconnect master
  if (masterPrisma) {
    try {
      await masterPrisma.$disconnect();
    } catch (error) {
      console.error('[PrismaManager] Error force disconnecting master client:', error);
    }
    masterPrisma = null;
  }
  
  console.log(`[PrismaManager] Force cleaned up ${schemaNames.length} connections`);
}

// Enhanced graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`[PrismaManager] Received ${signal}, shutting down gracefully...`);
  
  try {
    await Promise.race([
      disconnectAllClients(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
      ),
    ]);
    console.log('[PrismaManager] Graceful shutdown completed');
  } catch (error) {
    console.error('[PrismaManager] Error during graceful shutdown:', error);
    await forceCleanupConnections();
  }
  
  process.exit(0);
};

// Handle process termination
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Periodic cleanup of stale connections (every 5 minutes)
setInterval(async () => {
  try {
    await cleanupStaleSchemaConnections();
  } catch (error) {
    console.error('[PrismaManager] Error during periodic cleanup:', error);
  }
}, 5 * 60 * 1000);

// Export master client getter for backward compatibility
export { getMasterPrismaClient };

// Legacy compatibility - adapt database ID concept to admin ID
export async function getPrismaClientByDatabaseId(databaseId: string): Promise<PrismaClient | null> {
  console.warn('[PrismaManager] getPrismaClientByDatabaseId is deprecated, use getPrismaClientByAdminId instead');
  
  // Try to parse databaseId as adminId (number)
  const adminId = parseInt(databaseId);
  if (isNaN(adminId)) {
    console.error(`[PrismaManager] Invalid database ID format: ${databaseId}`);
    return null;
  }

  const result = await getPrismaClientByAdminId(adminId);
  return result?.client || null;
}

export async function getDatabaseInfo(databaseId: string) {
  console.warn('[PrismaManager] getDatabaseInfo is deprecated, use getAdminInfo instead');
  
  const adminId = parseInt(databaseId);
  if (isNaN(adminId)) {
    console.error(`[PrismaManager] Invalid database ID format: ${databaseId}`);
    return null;
  }

  const adminInfo = await getAdminInfo(adminId);
  if (!adminInfo) return null;

  return {
    name: adminInfo.schemaName,
    url: createSchemaUrl(getMasterDatabaseUrl(), adminInfo.schemaName)
  };
}