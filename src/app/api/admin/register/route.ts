// app/api/admin/register/route.ts - Updated without admin code requirement
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { execSync } from 'child_process';
import nodemailer from 'nodemailer';
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

// Helper function to generate OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email configuration
const createEmailTransporter = () => {
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
    console.log('📧 Using Gmail for email delivery');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
};

// Send confirmation email
async function sendConfirmationEmail(email: string, token: string, adminName: string) {
  try {
    const transporter = createEmailTransporter();
    const confirmationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/confirm-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'aymanafcat@gmail.com',
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
  role: 'admin' | 'super_admin';
  phoneVerified?: boolean;
  database?: {
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
  registrationMethod?: 'email' | 'phone';
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

// Get master database URL
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
    
    const existingSchemaResult = await client.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
      [schemaName]
    );
    
    if (existingSchemaResult.rows.length > 0) {
      throw new Error(`Schema '${schemaName}' already exists`);
    }
    
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
  },
  isPhoneRegistration: boolean = false
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
        // For phone registrations, auto-confirm since phone is already verified
        isConfirmed: isPhoneRegistration,
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
  },
  isPhoneRegistration: boolean = false
): Promise<{ adminUser: any }> {
  try {
    console.log(`🔧 Initializing schema '${schemaName}' with admin user...`);
    
    const adminUser = await createAdminAsUserInSchema(
      schemaName,
      adminId,
      adminData,
      isPhoneRegistration
    );
    
    console.log(`✅ Schema '${schemaName}' initialized successfully with admin user`);
    return { adminUser };
    
  } catch (error: any) {
    console.error('❌ Schema initialization failed:', error.message);
    throw new Error(`Failed to initialize schema: ${error.message}`);
  }
}

// Email validation function
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Enhanced validation function
function validateRequest(data: Partial<AdminRegistrationRequest>): string | null {
  if (!data.firstname || !data.lastname || !data.password || !data.role) {
    return 'Missing required fields';
  }

  if (!data.email && !data.phonenumber) {
    return 'Either email or phone number is required';
  }

  // Email validation
  if (data.email && !isValidEmail(data.email)) {
    return 'Please provide a valid email address';
  }

  if (!['admin', 'super_admin'].includes(data.role)) {
    return 'Invalid role specified';
  }

  if (data.password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  return null;
}

// Check if phone was verified during registration process
async function verifyPhoneRegistration(phoneNumber: string): Promise<boolean> {
  try {
    console.log('🔍 Checking phone verification status for:', phoneNumber);
    
    // Look for a recent, used OTP for this phone number
    const recentVerification = await publicDb.adminOTP.findFirst({
      where: {
        identifier: phoneNumber,
        type: 'phone',
        usedAt: { not: null }, // Must be used
        // Check if verification happened within last 10 minutes
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000)
        }
      },
      orderBy: {
        usedAt: 'desc'
      }
    });

    if (recentVerification) {
      console.log('✅ Phone verification found:', recentVerification.id);
      return true;
    }

    console.log('❌ No recent phone verification found');
    return false;
  } catch (error) {
    console.error('❌ Error checking phone verification:', error);
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<AdminRegistrationResponse>> {
  console.log('🚀 Starting admin registration process...');
  
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
      role,
      phoneVerified,
      database 
    } = body;

    console.log('📥 Registration request:', {
      firstname,
      lastname,
      email,
      phonenumber,
      role,
      phoneVerified,
      hasDatabase: !!database
    });

    // Basic validation
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // Determine registration method
    const isEmailRegistration = !!email;
    const isPhoneRegistration = !!phonenumber && !email;

    console.log('📝 Registration method:', isEmailRegistration ? 'EMAIL' : 'PHONE');

    // For phone registrations, verify that the phone was actually verified
    if (isPhoneRegistration) {
      console.log('📱 Verifying phone registration...');
      const phoneIsVerified = await verifyPhoneRegistration(phonenumber);
      
      if (!phoneIsVerified) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Phone number must be verified before registration. Please verify your phone number first.' 
          },
          { status: 400 }
        );
      }
      console.log('✅ Phone registration verified');
    }

    // Prepare admin email
    const adminEmail = email || `${phonenumber}@phone.local`;

    // Generate unique schema name
    const schemaName = database?.name || generateSchemaName(firstname, lastname);
    
    // Prepare schema configuration
    const schemaConfig = {
      name: schemaName,
      displayName: database?.displayName || `${firstname} ${lastname}'s Workspace`,
      description: database?.description || `Workspace managed by ${firstname} ${lastname}`,
      maxUsers: database?.maxUsers || 1000,
      maxStorage: database?.maxStorage || 10.0
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    let createdAdmin: any;
    let adminUser: any;
    let confirmationRecord: any;

    try {
      // Generate confirmation token only for email registrations
      const confirmationToken = isEmailRegistration ? crypto.randomUUID() : null;
      const tokenExpiry = isEmailRegistration ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

      // Step 1: Create admin in public schema
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

      // Step 1.5: Create confirmation record only for email registrations
      if (isEmailRegistration && confirmationToken && tokenExpiry) {
        console.log('🔐 Creating email confirmation token...');
        confirmationRecord = await publicDb.adminConfirmation.create({
          data: {
            adminId: createdAdmin.id,
            token: confirmationToken,
            expiresAt: tokenExpiry,
          }
        });
        console.log('✅ Email confirmation token created');
      }

      // Step 1.6: For phone registrations, mark the OTP as consumed for this admin
      if (isPhoneRegistration) {
        console.log('📱 Updating OTP record with admin ID...');
        
        // Update the most recent used OTP record with the admin ID
        await publicDb.adminOTP.updateMany({
          where: {
            identifier: phonenumber,
            type: 'phone',
            usedAt: { not: null },
            adminId: null // Only update records without admin ID
          },
          data: {
            adminId: createdAdmin.id
          }
        });
        
        console.log('✅ Phone OTP record updated with admin ID');
      }

      // Step 2: Create schema
      console.log('🗄️ Creating schema...');
      await createSchema(schemaName);

      // Step 3: Apply schema migrations
      console.log('📋 Applying schema migrations...');
      await applySchemaToNewSchema(schemaName);

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
        },
        isPhoneRegistration // Pass whether this is a phone registration
      );
      
      adminUser = initResult.adminUser;

      // Step 5: Send confirmation email only for email registrations
      if (isEmailRegistration && confirmationToken) {
        console.log('📧 Sending confirmation email...');
        try {
          await sendConfirmationEmail(
            adminEmail, 
            confirmationToken, 
            `${firstname} ${lastname}`
          );
        } catch (emailError) {
          console.error('❌ Failed to send confirmation email:', emailError);
          // Don't fail the entire registration
        }
      }

      // Step 6: For phone registrations, auto-confirm the admin
      if (isPhoneRegistration) {
        console.log('📱 Auto-confirming phone registration...');
        await publicDb.admin.update({
          where: { id: createdAdmin.id },
          data: { 
            isActive: true,
            // You might want to add a confirmed field to the Admin model
          }
        });
        console.log('✅ Phone registration auto-confirmed');
      }

    } catch (error: any) {
      console.error('❌ Registration process failed:', error.message);
      
      // Cleanup logic
      try {
        console.log('🧹 Attempting cleanup...');
        
        if (confirmationRecord) {
          await publicDb.adminConfirmation.delete({
            where: { id: confirmationRecord.id }
          });
        }
        
        if (createdAdmin) {
          await publicDb.adminOTP.deleteMany({
            where: { adminId: createdAdmin.id }
          });
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
        
        if (createdAdmin) {
          await publicDb.admin.delete({ where: { id: createdAdmin.id } });
        }
        
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
      
      throw error;
    }

    console.log('🎉 Admin registration completed successfully!');

    // Return response based on registration method
    if (isEmailRegistration && confirmationRecord) {
      // Email registration - needs confirmation
      return NextResponse.json<AdminRegistrationResponse>({
        success: true,
        requiresConfirmation: true,
        registrationMethod: 'email',
        message: `Registration successful! Please check your email at ${adminEmail} for confirmation instructions.`,
        data: {
          admin: {
            id: createdAdmin.id,
            firstname: createdAdmin.firstname,
            lastname: createdAdmin.lastname,
            email: createdAdmin.email,
            role: createdAdmin.role,
            schemaName: createdAdmin.schemaName,
            createdAt: createdAdmin.createdAt,
            isConfirmed: false
          }
        }
      }, { status: 201 });
    } else {
      // Phone registration - auto-confirmed
      return NextResponse.json<AdminRegistrationResponse>({
        success: true,
        requiresConfirmation: false,
        registrationMethod: 'phone',
        message: `Admin account created successfully! Phone number verified. You can now access the admin dashboard.`,
        data: {
          admin: {
            id: createdAdmin.id,
            firstname: createdAdmin.firstname,
            lastname: createdAdmin.lastname,
            email: createdAdmin.email,
            role: createdAdmin.role,
            schemaName: createdAdmin.schemaName,
            createdAt: createdAdmin.createdAt,
            isConfirmed: true
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

export type { AdminRegistrationRequest, AdminRegistrationResponse };