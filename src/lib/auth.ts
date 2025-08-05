// /lib/auth.ts - Updated for Schema-per-Tenant architecture
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { publicDb, getSchemaConnection } from '@/lib/database-connection';

// Extend NextAuth types for schema-per-tenant
declare module "next-auth" {
  interface User {
    id: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: string;
    schemaName: string; // Changed from databaseId to schemaName
    databaseId: string; // Keep for compatibility, but will be same as schemaName
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      firstName: string;
      lastName: string;
      companyId: string;
      role: string;
      schemaName: string; // Changed from databaseId to schemaName
      databaseId: string; // Keep for compatibility
    };
  }
}

// Use publicDb for NextAuth adapter (public schema for auth management)
const prisma = publicDb;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          firstName: profile.given_name || "",
          lastName: profile.family_name || "",
          companyId: "", // Changed from null to empty string
          role: "USER", // Keep as string
          schemaName: "", // Changed from databaseId to schemaName
          databaseId: "" // Keep for compatibility
        };
      },
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.id,
          name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
          email: profile.emailAddress,
          image: profile.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier,
          firstName: profile.localizedFirstName || "",
          lastName: profile.localizedLastName || "",
          companyId: "", // Added missing property
          role: "USER", // Added missing property
          schemaName: "", // Changed from databaseId to schemaName
          databaseId: "" // Keep for compatibility
        };
      },
    }),
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "linkedin") {
        try {
          // For schema-per-tenant, we need to find which schema the user belongs to
          // First, check if user exists in any active schema
          
          const activeAdmins = await publicDb.admin.findMany({
            where: { isActive: true },
            select: {
              id: true,
              schemaName: true,
              email: true,
            }
          });

          let userSchema: string | null = null;
          let existingUser: any = null;

          // Check each active schema for the user
          for (const admin of activeAdmins) {
            try {
              const schemaDb = await getSchemaConnection(admin.schemaName);
              const schemaUser = await schemaDb.beeusers.findFirst({
                where: { email: user.email! }
              });

              if (schemaUser) {
                existingUser = schemaUser;
                userSchema = admin.schemaName;
                break;
              }
            } catch (error) {
              console.warn(`Failed to check schema ${admin.schemaName} for user:`, error);
              continue;
            }
          }

          if (!existingUser) {
            // For new users, you need to determine which schema they belong to
            // This could be based on domain, invitation, or a default schema
            
            // Example: Get default admin/schema or create one
            let defaultAdmin = await publicDb.admin.findFirst({
              where: { 
                isActive: true,
                role: 'super_admin' // Or whatever your default logic is
              },
              orderBy: { createdAt: 'asc' }
            });

            if (!defaultAdmin) {
              throw new Error('No active admin schema found. Please contact administrator.');
            }

            // Create user in the default schema
            const randomPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 12);

            const defaultSchemaDb = await getSchemaConnection(defaultAdmin.schemaName);
            await defaultSchemaDb.beeusers.create({
              data: {
                firstname: (user as any).firstName || user.name?.split(" ")[0] || "",
                lastname: (user as any).lastName || user.name?.split(" ").slice(1).join(" ") || "",
                email: user.email!,
                password: hashedPassword,
                isConfirmed: true,
                isProfileComplete: false,
                role: 'user', // Default role in schema
                isAdmin: false,
                adminId: null, // Not linked to admin
              },
            });

            userSchema = defaultAdmin.schemaName;
          }

          return true;
        } catch (error) {
          console.error("Error during OAuth sign in:", error);
          return false;
        }
      }
      return true;
    },
    
    async jwt({ token, user, account }) {
      if (user?.email) {
        // Find which schema the user belongs to
        const activeAdmins = await publicDb.admin.findMany({
          where: { isActive: true },
          select: {
            id: true,
            schemaName: true,
            email: true,
          }
        });

        let userSchema: string | null = null;
        let dbUser: any = null;

        // Check each active schema for the user
        for (const admin of activeAdmins) {
          try {
            const schemaDb = await getSchemaConnection(admin.schemaName);
            const schemaUser = await schemaDb.beeusers.findFirst({
              where: { email: user.email },
              select: { 
                id: true, 
                email: true, 
                firstname: true, 
                lastname: true,
                role: true,
                isAdmin: true,
                adminId: true
              }
            });

            if (schemaUser) {
              dbUser = schemaUser;
              userSchema = admin.schemaName;
              break;
            }
          } catch (error) {
            console.warn(`Failed to check schema ${admin.schemaName} for user:`, error);
            continue;
          }
        }

        if (dbUser && userSchema) {
          token.userId = dbUser.id;
          token.email = dbUser.email;
          token.firstName = dbUser.firstname;
          token.lastName = dbUser.lastname;
          token.schemaName = userSchema; // Changed from databaseId to schemaName
          token.databaseId = userSchema; // Keep for compatibility
          token.companyId = ""; // Set default value
          token.role = dbUser.role || "USER"; // Use role from schema
          token.isAdmin = dbUser.isAdmin || false;
          token.adminId = dbUser.adminId;
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      if (token.userId) {
        session.user = {
          id: token.userId.toString(),
          email: token.email as string,
          name: session.user?.name || null,
          image: session.user?.image || null,
          firstName: token.firstName as string,
          lastName: token.lastName as string,
          companyId: token.companyId as string,
          role: token.role as string,
          schemaName: token.schemaName as string, // Changed from databaseId to schemaName
          databaseId: token.databaseId as string, // Keep for compatibility
        };
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

/**
 * Creates a JWT token for API authentication (schema-per-tenant)
 */
export function createJWTToken(userId: number, email: string, schemaName: string): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable is required');
  }

  const payload = {
    userId,
    email,
    schemaName, // Changed from databaseId to schemaName
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, secret);
}

/**
 * Creates a JWT token for admin authentication
 */
export function createAdminJWTToken(adminId: number, email: string, role: string, schemaName: string): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable is required');
  }

  const payload = {
    adminId,
    email,
    role,
    schemaName,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, secret);
}

/**
 * Enhanced JWT verification for schema-per-tenant
 */
export async function getUserFromToken(token: string): Promise<{ userId: string; schemaName: string } | null> {
  try {
    if (!token) {
      console.log('[getUserFromToken] No token provided');
      return null;
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
        
    if (!cleanToken) {
      console.log('[getUserFromToken] Empty token after cleaning');
      return null;
    }

    // Check if token looks like a JWT (has 3 parts separated by dots)
    const tokenParts = cleanToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('[getUserFromToken] Token does not appear to be a valid JWT format. Parts:', tokenParts.length);
      return null;
    }

    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[getUserFromToken] No JWT secret found');
      return null;
    }

    // Verify and decode JWT
    const decoded = jwt.verify(cleanToken, secret) as any;
    console.log('[getUserFromToken] Decoded JWT payload:', {
      userId: decoded.userId,
      email: decoded.email,
      schemaName: decoded.schemaName,
      iat: decoded.iat,
      exp: decoded.exp
    });

    let userId: string | null = null;
    let schemaName: string | null = decoded.schemaName || null;

    if (decoded.userId) {
      userId = decoded.userId.toString();
    } else if (decoded.email && decoded.schemaName) {
      // Search for user by email in the specific schema
      console.log('[getUserFromToken] userId undefined, searching by email in schema:', decoded.schemaName);
      
      try {
        const schemaDb = await getSchemaConnection(decoded.schemaName);
        const dbUser = await schemaDb.beeusers.findFirst({
          where: { email: decoded.email },
          select: { id: true }
        });
        
        if (dbUser) {
          userId = dbUser.id.toString();
          console.log('[getUserFromToken] Found user in schema:', { userId, schemaName });
        } else {
          console.warn('[getUserFromToken] User not found in schema with email:', decoded.email);
        }
      } catch (error) {
        console.error('[getUserFromToken] Error searching user in schema:', error);
        return null;
      }
    }

    if (!userId || !schemaName) {
      console.warn('[getUserFromToken] Missing userId or schemaName after lookup');
      return null;
    }

    // Verify user still exists in the schema
    console.log('[getUserFromToken] Verifying user exists in schema...');
    
    try {
      const schemaDb = await getSchemaConnection(schemaName);
      const userExists = await schemaDb.beeusers.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, isConfirmed: true, role: true }
      });

      if (!userExists) {
        console.warn('[getUserFromToken] User no longer exists in schema:', userId);
        return null;
      }

      console.log('[getUserFromToken] User verified and exists in schema:', { userId, schemaName });
      return { userId, schemaName };
      
    } catch (error) {
      console.error('[getUserFromToken] Error verifying user in schema:', error);
      return null;
    }

  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[getUserFromToken] JWT token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[getUserFromToken] Invalid JWT token format or signature');
      console.log('[getUserFromToken] Error details:', error.message);
    } else {
      console.error('[getUserFromToken] JWT verification error:', error.message);
    }
    return null;
  }
}

/**
 * Get admin from JWT token (for admin authentication)
 */
export async function getAdminFromToken(token: string): Promise<{ adminId: string; schemaName: string; role: string } | null> {
  try {
    if (!token) {
      console.log('[getAdminFromToken] No token provided');
      return null;
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    
    if (!cleanToken) {
      console.log('[getAdminFromToken] Empty token after cleaning');
      return null;
    }

    const tokenParts = cleanToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('[getAdminFromToken] Invalid JWT format');
      return null;
    }

    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[getAdminFromToken] No JWT secret found');
      return null;
    }

    const decoded = jwt.verify(cleanToken, secret) as any;
    console.log('[getAdminFromToken] Decoded admin JWT:', {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      schemaName: decoded.schemaName
    });

    if (!decoded.adminId || !decoded.schemaName || !decoded.role) {
      console.warn('[getAdminFromToken] Missing required admin token fields');
      return null;
    }

    // Verify admin exists in public database
    const admin = await publicDb.admin.findUnique({
      where: { id: decoded.adminId },
      select: { 
        id: true, 
        schemaName: true, 
        role: true, 
        isActive: true 
      }
    });

    if (!admin || !admin.isActive) {
      console.warn('[getAdminFromToken] Admin not found or inactive:', decoded.adminId);
      return null;
    }

    if (admin.schemaName !== decoded.schemaName) {
      console.warn('[getAdminFromToken] Schema name mismatch');
      return null;
    }

    return {
      adminId: decoded.adminId.toString(),
      schemaName: decoded.schemaName,
      role: decoded.role
    };

  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[getAdminFromToken] Admin JWT token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[getAdminFromToken] Invalid admin JWT token');
    } else {
      console.error('[getAdminFromToken] Admin JWT verification error:', error.message);
    }
    return null;
  }
}

/**
 * Simplified authentication for API routes - JWT ONLY (schema-per-tenant)
 */
export async function authenticateRequest(request: NextRequest): Promise<{ userId: string; schemaName: string } | null> {
  try {
    // Only check Authorization header for JWT token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      console.log('[authenticateRequest] No authorization header');
      return null;
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('[authenticateRequest] Invalid authorization header format');
      return null;
    }

    const token = authHeader.substring(7);
    const userInfo = await getUserFromToken(token);

    if (userInfo) {
      console.log('[authenticateRequest] Authenticated user:', userInfo);
      return userInfo;
    } else {
      console.log('[authenticateRequest] Token validation failed');
      return null;
    }

  } catch (error) {
    console.error('[authenticateRequest] Authentication error:', error);
    return null;
  }
}

/**
 * Admin authentication for API routes
 */
export async function authenticateAdminRequest(request: NextRequest): Promise<{ adminId: string; schemaName: string; role: string } | null> {
  try {
    // Check cookies first (for web requests)
    const cookies = request.cookies;
    const adminTokenNames = ['admin-token', 'admin_token', 'adminToken'];
    let adminToken: string | undefined;
    
    for (const tokenName of adminTokenNames) {
      const token = cookies.get(tokenName)?.value;
      if (token) {
        adminToken = token;
        break;
      }
    }
    
    // Check Authorization header if no cookie found
    if (!adminToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        adminToken = authHeader.substring(7);
      }
    }

    if (!adminToken) {
      console.log('[authenticateAdminRequest] No admin token found');
      return null;
    }

    const adminInfo = await getAdminFromToken(adminToken);

    if (adminInfo) {
      console.log('[authenticateAdminRequest] Authenticated admin:', adminInfo);
      return adminInfo;
    } else {
      console.log('[authenticateAdminRequest] Admin token validation failed');
      return null;
    }

  } catch (error) {
    console.error('[authenticateAdminRequest] Admin authentication error:', error);
    return null;
  }
}

/**
 * Get current user from JWT token (schema-per-tenant)
 */
export async function getCurrentUser(request: NextRequest) {
  try {
    const userInfo = await authenticateRequest(request);
    if (!userInfo) return null;

    // Get user from their specific schema
    const schemaDb = await getSchemaConnection(userInfo.schemaName);
    const dbUser = await schemaDb.beeusers.findUnique({
      where: { id: parseInt(userInfo.userId) },
      include: {
        tokenStats: true,
        batches: true,
      },
    });

    return dbUser;
  } catch (error) {
    console.error('[getCurrentUser] Error:', error);
    return null;
  }
}

/**
 * Get current admin from JWT token
 */
export async function getCurrentAdmin(request: NextRequest) {
  try {
    const adminInfo = await authenticateAdminRequest(request);
    if (!adminInfo) return null;

    // Get admin from public database
    const admin = await publicDb.admin.findUnique({
      where: { id: parseInt(adminInfo.adminId) },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        schemaName: true,
        displayName: true,
        isActive: true,
        createdAt: true,
      }
    });

    return admin;
  } catch (error) {
    console.error('[getCurrentAdmin] Error:', error);
    return null;
  }
}

/**
 * Find user's schema by email (utility function)
 */
export async function findUserSchema(email: string): Promise<string | null> {
  try {
    const activeAdmins = await publicDb.admin.findMany({
      where: { isActive: true },
      select: {
        schemaName: true,
      }
    });

    for (const admin of activeAdmins) {
      try {
        const schemaDb = await getSchemaConnection(admin.schemaName);
        const user = await schemaDb.beeusers.findFirst({
          where: { email: email },
          select: { id: true }
        });

        if (user) {
          return admin.schemaName;
        }
      } catch (error) {
        console.warn(`Failed to check schema ${admin.schemaName} for user ${email}:`, error);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding user schema:', error);
    return null;
  }
}

// Keep the rest of your utility functions unchanged
export function clearClientSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('next-auth.session-token');
    localStorage.removeItem('next-auth.csrf-token');
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('adminToken');
    
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('next-auth') || key.startsWith('auth') || key.startsWith('admin')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[clearClientSession] All client-side auth data cleared');
  }
}

export async function performLogout() {
  try {
    console.log('[performLogout] Starting logout process...');
    
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      console.warn('[performLogout] Logout API failed, continuing with client cleanup');
    }

    clearClientSession();
    
    console.log('[performLogout] Logout completed successfully');
    return true;
  } catch (error) {
    console.error('[performLogout] Error during logout:', error);
    clearClientSession();
    return false;
  }
}

export default authOptions;