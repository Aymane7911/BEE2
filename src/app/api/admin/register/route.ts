// app/api/admin/register/route.ts - With Gmail Email Confirmation
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { execSync } from 'child_process';
import nodemailer from 'nodemailer';
// Updated import to use the working database connection
import { publicDb, createAdminEntry } from '@/lib/database-connection';

// Test database connection on startup
async function testPrismaConnection() {
  try {
    await publicDb.$connect();
    console.log('✅ Master Prisma connection established successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Master Prisma connection failed:', error.message);
    console.error('   Make sure your DATABASE_URL is correct and the database is running');
    return false;
  }
}

// Email configuration - Updated to use Gmail
const createEmailTransporter = () => {
  // For production, use services like SendGrid, AWS SES, etc.
  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else if (process.env.EMAIL_SERVICE === 'smtp') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Default to Gmail using your credentials
    console.log('📧 Using Gmail for email delivery');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // aymanafcat@gmail.com
        pass: process.env.EMAIL_PASSWORD, // dgbs euvj wzue qipb (your app password)
      },
    });
  }
};

// Send confirmation email - Updated with your email as sender
async function sendConfirmationEmail(email: string, token: string, adminName: string) {
  try {
    const transporter = createEmailTransporter();
    const confirmationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/confirm-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'aymanafcat@gmail.com', // Use your Gmail as sender
      to: email,
      subject: 'Confirm Your Admin Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Confirm Your Admin Account</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3B82F6, #6366F1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: linear-gradient(135deg, #3B82F6, #6366F1); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛡️ Admin Account Confirmation</h1>
              <p>Welcome to the Admin Portal</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName}!</h2>
              <p>Thank you for registering as an administrator. To complete your account setup and activate your admin privileges, please confirm your email address.</p>
              
              <div style="text-align: center;">
                <a href="${confirmationUrl}" class="button">Confirm Admin Account</a>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This confirmation link will expire in 24 hours for security reasons.
              </div>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px;">
                ${confirmationUrl}
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
              
              <h3>What happens after confirmation?</h3>
              <ul>
                <li>✅ Your admin account will be activated</li>
                <li>🗄️ Your dedicated database schema will be initialized</li>
                <li>👥 You'll be able to manage users and system settings</li>
                <li>📊 Access to the admin dashboard will be granted</li>
              </ul>
              
              <p>If you didn't request this admin account, please ignore this email or contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 Admin Portal. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Confirmation email sent successfully:', info.messageId);
    console.log('📧 Email sent from:', process.env.EMAIL_USER);
    console.log('📧 Email sent to:', email);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
    throw new Error('Failed to send confirmation email');
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
  requiresConfirmation?: boolean;
  data?: {
    admin: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      schemaName: string;
      createdAt: Date;
      isConfirmed: boolean;
    };
    adminUser?: {
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
    database: process.env.DB_NAME || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
    
    const baseUrl = getMasterDatabaseUrl();
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
  const { getSchemaConnection } = await import('@/lib/database-connection');
  
  try {
    const schemaPrisma = await getSchemaConnection(schemaName);
    console.log(`✅ Connected to schema '${schemaName}' for user creation`);

    const adminUser = await schemaPrisma.beeusers.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: adminData.password,
        role: 'admin',
        isAdmin: true,
        adminId: adminId,
        isConfirmed: false, // Will be confirmed when admin email is confirmed
        isProfileComplete: true,
      }
    });

    console.log(`✅ Admin created as user in schema '${schemaName}' with ID: ${adminUser.id}`);
    return adminUser;

  } catch (error: any) {
    console.error('❌ Failed to create admin as user in schema:', error.message);
    throw new Error(`Failed to create admin as user in schema: ${error.message}`);
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
  console.log('🚀 Starting admin registration process with email confirmation...');
  
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
    const hasRealEmail = !!email; // Only send confirmation for real emails

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
    let confirmationRecord: any;

    try {
      // Generate confirmation token for email users
      const confirmationToken = hasRealEmail ? crypto.randomUUID() : null;
      const tokenExpiry = hasRealEmail ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null; // 24 hours

      // Step 1: Create admin in public schema (WITHOUT confirmation fields)
      console.log('👤 Creating admin in public schema...');
      createdAdmin = await createAdminEntry({
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
      });
      
      console.log(`✅ Admin created in public schema with ID: ${createdAdmin.id}`);

      // Step 1.5: Create confirmation record if email confirmation is needed
      if (hasRealEmail && confirmationToken && tokenExpiry) {
        console.log('🔐 Creating confirmation token...');
        confirmationRecord = await publicDb.adminConfirmation.create({
          data: {
            adminId: createdAdmin.id,
            token: confirmationToken,
            expiresAt: tokenExpiry,
          }
        });
        console.log('✅ Confirmation token created');
      }

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

      // Step 5: Send confirmation email if real email provided
      if (hasRealEmail && confirmationToken) {
        console.log('📧 Sending confirmation email...');
        try {
          await sendConfirmationEmail(
            adminEmail, 
            confirmationToken, 
            `${firstname} ${lastname}`
          );
          console.log('✅ Confirmation email sent successfully');
        } catch (emailError) {
          console.error('❌ Failed to send confirmation email:', emailError);
          // Don't fail the entire registration, but log the error
          // You might want to set a flag to resend later
        }
      }

    } catch (error: any) {
      console.error('❌ Registration process failed:', error.message);
      
      // Enhanced cleanup logic
      try {
        console.log('🧹 Attempting to cleanup created resources...');
        
        // Cleanup confirmation record if it exists
        if (confirmationRecord) {
          await publicDb.adminConfirmation.delete({
            where: { id: confirmationRecord.id }
          });
          console.log('✅ Confirmation record cleanup completed');
        }
        
        // Cleanup schema
        const client = new Client({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_ADMIN_USER || 'postgres',
          password: process.env.DB_ADMIN_PASSWORD,
          database: process.env.DB_NAME || 'postgres',
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        await client.connect();
        await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await client.end();
        console.log('✅ Schema cleanup completed');
        
        // Cleanup admin record (this will cascade delete the confirmation record if it exists)
        if (createdAdmin) {
          await publicDb.admin.delete({ where: { id: createdAdmin.id } });
          console.log('✅ Admin record cleanup completed');
        }
        
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
      
      throw error;
    }

    console.log('🎉 Admin registration completed successfully!');

    // Check if admin needs confirmation by looking at the confirmation record
    const needsConfirmation = hasRealEmail && confirmationRecord && !confirmationRecord.confirmedAt;

    // Return different responses based on confirmation requirement
    if (needsConfirmation) {
      return NextResponse.json<AdminRegistrationResponse>({
        success: true,
        requiresConfirmation: true,
        message: `Registration successful! Please check your email at ${adminEmail} for confirmation instructions. Your admin account will be activated after email confirmation.`,
        data: {
          admin: {
            id: createdAdmin.id,
            firstname: createdAdmin.firstname,
            lastname: createdAdmin.lastname,
            email: createdAdmin.email,
            role: createdAdmin.role,
            schemaName: createdAdmin.schemaName,
            createdAt: createdAdmin.createdAt,
            isConfirmed: false // Not confirmed yet
          }
        }
      }, { status: 201 });
    } else {
      // Phone registration or no email confirmation required
      return NextResponse.json<AdminRegistrationResponse>({
        success: true,
        requiresConfirmation: false,
        message: `Admin account and schema '${schemaName}' created successfully. You can now access the admin dashboard.`,
        data: {
          admin: {
            id: createdAdmin.id,
            firstname: createdAdmin.firstname,
            lastname: createdAdmin.lastname,
            email: createdAdmin.email,
            role: createdAdmin.role,
            schemaName: createdAdmin.schemaName,
            createdAt: createdAdmin.createdAt,
            isConfirmed: true // Auto-confirmed for phone registrations
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
    }

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