// lib/admin-auth.ts - Updated for new multi-tenant schema structure
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface AdminSession {
  adminId: number;
  email: string;
  role: string;
  schemaName: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const prisma = new PrismaClient();

/**
 * Generate JWT token for admin
 */
export function generateAdminToken(admin: {
  id: number;
  email: string;
  role: string;
  schemaName: string;
}): string {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      schemaName: admin.schemaName,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify admin token
 */
export function verifyAdminToken(token: string): AdminSession {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminSession;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get admin session from request
 */
export async function getAdminFromRequest(request: NextRequest): Promise<AdminSession> {
  console.log('=== Admin Auth Debug ===');
  console.log('URL:', request.url);
  console.log('Method:', request.method);
  
  // Log all cookies
  const allCookies = request.cookies.getAll();
  console.log('All cookies:', allCookies);
  
  // Log all headers
  console.log('Authorization header:', request.headers.get('authorization'));
  
  // Try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('Found Bearer token:', token ? 'YES' : 'NO');
  }

  // If no Authorization header, try to get from cookies
  if (!token) {
    const adminTokenCookie = request.cookies.get('admin-token');
    token = adminTokenCookie?.value || null;
    console.log('Admin token cookie:', adminTokenCookie);
    console.log('Token from cookie:', token ? 'YES' : 'NO');
  }

  console.log('Final token found:', token ? 'YES' : 'NO');

  if (!token) {
    console.log('ERROR: No authentication token provided');
    throw new Error('No authentication token provided');
  }

  console.log('Verifying token...');
  const session = verifyAdminToken(token);
  console.log('Token verified successfully for admin ID:', session.adminId);

  // Verify admin exists in public schema
  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || !admin.isActive) {
    console.log('ERROR: Admin not found or inactive in public schema');
    throw new Error('Admin account not found or inactive');
  }

  // Verify schema name matches
  if (admin.schemaName !== session.schemaName) {
    console.log('ERROR: Schema name mismatch');
    throw new Error('Schema name mismatch');
  }

  console.log('Authentication successful for:', admin.email);
  console.log('Schema:', admin.schemaName);
  console.log('=== End Debug ===');

  return {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    schemaName: admin.schemaName,
  };
}

/**
 * Admin login function - Updated to work with new schema structure
 */
export async function loginAdmin(email: string, password: string): Promise<{
  token: string;
  admin: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
    schemaName: string;
    displayName: string | null;
  };
}> {
  const bcrypt = require('bcryptjs');

  // Find admin in public schema
  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  if (!admin || !admin.isActive) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, admin.password);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate token
  const token = generateAdminToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    schemaName: admin.schemaName,
  });

  return {
    token,
    admin: {
      id: admin.id,
      firstname: admin.firstname,
      lastname: admin.lastname,
      email: admin.email,
      role: admin.role,
      schemaName: admin.schemaName,
      displayName: admin.displayName,
    },
  };
}

/**
 * Get admin by email (utility function)
 */
export async function findAdminByEmail(email: string): Promise<any | null> {
  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
    });
    return admin;
  } catch (error) {
    console.error('Error finding admin by email:', error);
    return null;
  }
}

/**
 * Set search path for tenant operations
 */
export async function setTenantSearchPath(schemaName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
}

/**
 * Reset search path to public
 */
export async function resetSearchPath(): Promise<void> {
  await prisma.$executeRawUnsafe(`SET search_path TO public`);
}

/**
 * Execute operation in tenant schema context
 */
export async function withTenantSchema<T>(
  schemaName: string, 
  operation: () => Promise<T>
): Promise<T> {
  try {
    await setTenantSearchPath(schemaName);
    return await operation();
  } finally {
    await resetSearchPath();
  }
}