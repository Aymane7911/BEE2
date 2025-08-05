// app/api/admin/register/route.ts - Schema-per-Tenant Version
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { execSync } from 'child_process';

// Initialize Prisma for public schema (admin management)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Test database connection on startup
async function testPrismaConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connection established successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Prisma connection failed:', error.message);
    console.error('   Make sure your DATABASE_URL is correct and the database is running');
    return false;
  }
}

// Types
interface AdminRegistrationRequest {
  firstname: string;
  lastname: string;
  email?: string;
  phonenumber?: string;
  password: string;
  adminCode: string;
  role: 'admin' | 'super_admin';
  schema?: {
    name?: string;
    displayName?: string;
    description?: string;
    maxUsers?: number;
    maxStorage?: number;
  };
}

interface AdminRegistrationResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    admin: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      schemaName: string;
      createdAt: Date;
    };
    adminUser: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      isAdmin: boolean;
      adminId: number | null;
      createdAt: Date;
    };
  };
}

// Admin authorization codes
const ADMIN_CODES: Record<string, string> = {
  super_admin: process.env.SUPER_ADMIN_CODE || 'super_admin_2024_secure',
  admin: process.env.ADMIN_CODE || 'admin_2024_secure'
};

// Generate unique schema name
function generateSchemaName(firstname: string, lastname: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${firstname.toLowerCase()}_${lastname.toLowerCase()}_${timestamp}_${random}`;
}

// Create schema in database
async function createSchema(schemaName: string): Promise<void> {
  console.log(`🗄️ Creating schema: ${schemaName}`);
  
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_ADMIN_USER || 'postgres',
    password: process.env.DB_ADMIN_PASSWORD,
    database: process.env.DB_NAME || 'postgres'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database for schema creation');
    
    // Check if schema already exists
    const existingSchemaResult = await client.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
      [schemaName]
    );
    
    if (existingSchemaResult.rows.length > 0) {
      throw new Error(`Schema '${schemaName}' already exists`);
    }
    
    // Create the schema
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    console.log(`✅ Schema '${schemaName}' created successfully`);
    
  } catch (error: any) {
    console.error('❌ Schema creation error:', error.message);
    throw new Error(`Failed to create schema: ${error.message}`);
  } finally {
    await client.end();
  }
}

// Apply schema migrations to the new schema
async function applySchemaToNewSchema(schemaName: string): Promise<void> {
  try {
    console.log(`📋 Applying schema migrations to: ${schemaName}`);
    
    // Create a temporary DATABASE_URL for the specific schema
    const baseUrl = process.env.DATABASE_URL;
    const schemaUrl = `${baseUrl}?schema=${schemaName}`;
    
    execSync(`npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate`, {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        DATABASE_URL: schemaUrl,
        CI: 'true'
      },
      timeout: 45000
    });
    
    console.log(`✅ Schema applied successfully to: ${schemaName}`);
    
  } catch (error: any) {
    console.error(`❌ Failed to apply schema to ${schemaName}:`, error.message);
    throw new Error(`Failed to apply schema to "${schemaName}": ${error.message}`);
  }
}

// Create admin as user in beeusers table within the schema
async function createAdminAsUserInSchema(
  schemaName: string,
  adminId: number,
  adminData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    role: string;
  }
): Promise<any> {
  // Create connection URL for the specific schema
  const baseUrl = process.env.DATABASE_URL;
  const schemaUrl = `${baseUrl}?schema=${schemaName}`;

  const schemaPrisma = new PrismaClient({
    datasources: {
      db: {
        url: schemaUrl,
      },
    },
  });

  try {
    await schemaPrisma.$connect();
    console.log(`✅ Connected to schema '${schemaName}' for user creation`);

    // Create admin as a user in beeusers table within the schema
    const adminUser = await schemaPrisma.beeusers.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: adminData.password,
        role: 'admin', // Set role as admin in beeusers
        isAdmin: true, // Mark as admin
        adminId: adminId, // Reference to admin table (in public schema)
        isConfirmed: true, // Auto-confirm admin users
        isProfileComplete: true, // Mark profile as complete
      }
    });

    console.log(`✅ Admin created as user in schema '${schemaName}' with ID: ${adminUser.id}`);
    return adminUser;

  } catch (error: any) {
    console.error('❌ Failed to create admin as user in schema:', error.message);
    throw new Error(`Failed to create admin as user in schema: ${error.message}`);
  } finally {
    await schemaPrisma.$disconnect();
  }
}

// Initialize new schema with admin user
async function initializeNewSchema(
  schemaName: string,
  adminId: number,
  adminData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    role: string;
  }
): Promise<{ adminUser: any }> {
  try {
    console.log(`🔧 Initializing schema '${schemaName}' with admin user...`);
    
    // Create admin as a user in beeusers table within the schema
    console.log('👥 Creating admin as user in beeusers table within schema...');
    const adminUser = await createAdminAsUserInSchema(
      schemaName,
      adminId,
      adminData
    );
    
    console.log(`✅ Schema '${schemaName}' initialized successfully with admin user`);
    return { adminUser };
    
  } catch (error: any) {
    console.error('❌ Schema initialization failed:', error.message);
    throw new Error(`Failed to initialize schema: ${error.message}`);
  }
}

function validateRequest(data: Partial<AdminRegistrationRequest>): string | null {
  if (!data.firstname || !data.lastname || !data.password || !data.adminCode || !data.role) {
    return 'Missing required fields';
  }

  if (!data.email && !data.phonenumber) {
    return 'Either email or phone number is required';
  }

  if (!['admin', 'super_admin'].includes(data.role)) {
    return 'Invalid role specified';
  }

  if (data.password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (data.adminCode !== ADMIN_CODES[data.role]) {
    return 'Invalid admin authorization code';
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<AdminRegistrationResponse>> {
  console.log('🚀 Starting admin registration process (Schema-per-Tenant)...');
  
  // Test database connection first
  const connectionTest = await testPrismaConnection();
  if (!connectionTest) {
    return NextResponse.json<AdminRegistrationResponse>(
      { 
        success: false, 
        error: 'Database connection failed. Please check your database configuration and ensure the database server is running.' 
      },
      { status: 500 }
    );
  }
  
  try {
    const body: AdminRegistrationRequest = await request.json();
    
    const { 
      firstname, 
      lastname, 
      email, 
      phonenumber, 
      password, 
      adminCode, 
      role,
      schema 
    } = body;

    // Validation
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // Prepare admin email
    const adminEmail = email || `${phonenumber}@phone.local`;

    // Generate unique schema name
    const schemaName = schema?.name || generateSchemaName(firstname, lastname);
    
    // Prepare schema configuration
    const schemaConfig = {
      name: schemaName,
      displayName: schema?.displayName || `${firstname} ${lastname}'s Workspace`,
      description: schema?.description || `Workspace managed by ${firstname} ${lastname}`,
      maxUsers: schema?.maxUsers || 1000,
      maxStorage: schema?.maxStorage || 10.0
    };

    console.log('📝 Schema config:', schemaConfig);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    let createdAdmin: any;
    let adminUser: any;

    try {
      // Step 1: Create admin in public schema (for global admin management)
      console.log('👤 Creating admin in public schema...');
      createdAdmin = await prisma.admin.create({
        data: {
          firstname,
          lastname,
          email: adminEmail,
          password: hashedPassword,
          role,
          schemaName: schemaName,
          displayName: schemaConfig.displayName,
          description: schemaConfig.description,
          maxUsers: schemaConfig.maxUsers,
          maxStorage: schemaConfig.maxStorage,
          isActive: true,
        }
      });
      console.log(`✅ Admin created in public schema with ID: ${createdAdmin.id}`);

      // Step 2: Create schema
      console.log('🗄️ Creating schema...');
      await createSchema(schemaName);
      console.log('✅ Schema created successfully');

      // Step 3: Apply schema migrations to new schema
      console.log('📋 Applying schema migrations to new schema...');
      await applySchemaToNewSchema(schemaName);
      console.log('✅ Schema migrations applied successfully');

      // Step 4: Initialize the new schema with admin user
      console.log('🔧 Initializing new schema with admin user...');
      const initResult = await initializeNewSchema(
        schemaName,
        createdAdmin.id,
        {
          firstname,
          lastname,
          email: adminEmail,
          password: hashedPassword,
          role
        }
      );
      
      adminUser = initResult.adminUser;
      console.log('✅ New schema initialized successfully');

    } catch (error: any) {
      console.error('❌ Registration process failed:', error.message);
      
      // Cleanup: Try to remove the schema if it was created
      try {
        console.log('🧹 Attempting to cleanup created schema...');
        const client = new Client({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_ADMIN_USER || 'postgres',
          password: process.env.DB_ADMIN_PASSWORD,
          database: process.env.DB_NAME || 'postgres'
        });
        
        await client.connect();
        await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await client.end();
        console.log('✅ Schema cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Schema cleanup failed:', cleanupError);
      }

      // Cleanup: Remove admin from public schema if created
      if (createdAdmin) {
        try {
          await prisma.admin.delete({ where: { id: createdAdmin.id } });
          console.log('✅ Public schema admin cleanup completed');
        } catch (cleanupError) {
          console.error('❌ Public schema admin cleanup failed:', cleanupError);
        }
      }
      
      throw error;
    }

    console.log('🎉 Admin registration completed successfully!');

    return NextResponse.json<AdminRegistrationResponse>({
      success: true,
      message: `Admin account and schema '${schemaName}' created successfully. Admin registered in public schema and added as user in their own schema.`,
      data: {
        admin: {
          id: createdAdmin.id,
          firstname: createdAdmin.firstname,
          lastname: createdAdmin.lastname,
          email: createdAdmin.email,
          role: createdAdmin.role,
          schemaName: createdAdmin.schemaName,
          createdAt: createdAdmin.createdAt
        },
        adminUser: {
          id: adminUser.id,
          firstname: adminUser.firstname,
          lastname: adminUser.lastname,
          email: adminUser.email,
          role: adminUser.role,
          isAdmin: adminUser.isAdmin,
          adminId: adminUser.adminId,
          createdAt: adminUser.createdAt
        }
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Admin registration error:', error);

    if (error.message.includes('connection') || error.message.includes('Authentication failed')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { 
          success: false, 
          error: 'Database connection failed. Please check your database configuration.' 
        },
        { status: 500 }
      );
    }
    
    if (error.message.includes('Schema creation failed') || error.message.includes('Failed to create schema')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { success: false, error: 'Failed to create schema. Please contact system administrator.' },
        { status: 500 }
      );
    }
    
    if (error.message.includes('Schema application failed') || error.message.includes('Failed to apply schema')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { success: false, error: 'Failed to set up schema structure. Please contact system administrator.' },
        { status: 500 }
      );
    }

    if (error.code === 'P2002') {
      const constraint = error.meta?.target;
      if (constraint?.includes('email')) {
        return NextResponse.json<AdminRegistrationResponse>(
          { success: false, error: 'Admin with this email already exists' },
          { status: 409 }
        );
      }
      if (constraint?.includes('schemaName')) {
        return NextResponse.json<AdminRegistrationResponse>(
          { success: false, error: 'Schema name already exists. Please try again.' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json<AdminRegistrationResponse>(
      { success: false, error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(): Promise<NextResponse<AdminRegistrationResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<AdminRegistrationResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<AdminRegistrationResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export type { AdminRegistrationRequest, AdminRegistrationResponse };