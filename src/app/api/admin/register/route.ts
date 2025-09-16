// app/api/admin/register/route.ts - Railway-Optimized with Resend
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { execSync } from 'child_process';
import { Resend } from 'resend';
import { publicDb, createAdminEntry } from '@/lib/database-connection';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

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

// Railway-optimized email sending with Resend
async function sendConfirmationEmail(email: string, token: string, adminName: string): Promise<boolean> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured. Please add it to your Railway environment variables.');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 Resend email attempt ${attempt}/${maxRetries}`);
      
      const confirmationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/confirm-email?token=${token}`;
      const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev';
      
      // Validate from email domain if using custom domain
      if (!fromEmail.includes('@resend.dev') && !process.env.RESEND_VERIFIED_DOMAIN) {
        console.warn('⚠️ Using custom domain without RESEND_VERIFIED_DOMAIN. Make sure your domain is verified in Resend.');
      }

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject: 'Confirm Your Admin Account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Confirm Your Admin Account</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background-color: #f4f4f4;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              }
              .header { 
                background: linear-gradient(135deg, #3B82F6, #6366F1); 
                color: white; 
                padding: 40px 30px; 
                text-align: center; 
              }
              .header h1 { 
                margin: 0 0 10px 0; 
                font-size: 28px; 
                font-weight: 700; 
              }
              .header p { 
                margin: 0; 
                opacity: 0.9; 
                font-size: 16px; 
              }
              .content { 
                padding: 40px 30px; 
              }
              .content h2 { 
                color: #1f2937; 
                margin: 0 0 20px 0; 
                font-size: 24px; 
              }
              .content p { 
                margin: 0 0 20px 0; 
                color: #4b5563; 
              }
              .button-container { 
                text-align: center; 
                margin: 30px 0; 
              }
              .button { 
                display: inline-block; 
                background: linear-gradient(135deg, #3B82F6, #6366F1); 
                color: white; 
                padding: 16px 32px; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: 600; 
                font-size: 16px;
                transition: transform 0.2s ease;
              }
              .button:hover { 
                transform: translateY(-1px); 
              }
              .warning { 
                background: #fef3c7; 
                border: 1px solid #f59e0b; 
                padding: 16px; 
                border-radius: 8px; 
                margin: 25px 0; 
              }
              .warning strong { 
                color: #92400e; 
              }
              .url-box { 
                word-break: break-all; 
                background: #f3f4f6; 
                padding: 16px; 
                border-radius: 6px; 
                font-family: 'Monaco', 'Menlo', monospace; 
                font-size: 14px; 
                border: 1px solid #e5e7eb;
              }
              .feature-list { 
                margin: 20px 0; 
              }
              .feature-list li { 
                margin: 8px 0; 
                color: #4b5563; 
              }
              .divider { 
                margin: 30px 0; 
                border: none; 
                border-top: 1px solid #e5e7eb; 
              }
              .footer { 
                text-align: center; 
                padding: 30px; 
                background: #f9fafb; 
                color: #6b7280; 
                font-size: 14px; 
              }
              .footer p { 
                margin: 5px 0; 
              }
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
                <p>Thank you for registering as an administrator. To complete your account setup and activate your admin privileges, please confirm your email address by clicking the button below.</p>
                
                <div class="button-container">
                  <a href="${confirmationUrl}" class="button">Confirm Admin Account</a>
                </div>
                
                <div class="warning">
                  <strong>⚠️ Important Security Notice:</strong> This confirmation link will expire in 24 hours for security reasons. Please confirm your account promptly.
                </div>
                
                <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
                <div class="url-box">${confirmationUrl}</div>
                
                <hr class="divider">
                
                <h3>What happens after confirmation?</h3>
                <ul class="feature-list">
                  <li>✅ Your admin account will be activated instantly</li>
                  <li>🗄️ Your dedicated database schema will be fully initialized</li>
                  <li>👥 You'll gain full access to user management and system settings</li>
                  <li>📊 The complete admin dashboard will be unlocked</li>
                  <li>🔒 Advanced security features will be enabled</li>
                </ul>
                
                <p><strong>Didn't request this account?</strong> If you didn't register for an admin account, please ignore this email or contact our support team immediately.</p>
              </div>
              
              <div class="footer">
                <p>© 2024 Admin Portal. All rights reserved.</p>
                <p>This is an automated message sent via Resend. Please do not reply to this email.</p>
                <p>Powered by Railway + Resend</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
      }

      console.log('✅ Confirmation email sent successfully via Resend:', data?.id);
      return true;

    } catch (error: any) {
      lastError = error;
      console.error(`❌ Resend attempt ${attempt} failed:`, error.message);
      
      // Log specific Resend errors for better debugging
      if (error.message?.includes('API key')) {
        console.error('🔑 Resend API Key Error: Check your RESEND_API_KEY environment variable');
      } else if (error.message?.includes('domain')) {
        console.error('🌐 Resend Domain Error: Verify your sending domain in Resend dashboard');
      } else if (error.message?.includes('rate limit')) {
        console.error('⏱️ Resend Rate Limit: You may have exceeded your plan limits');
      }
      
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * attempt, 3000); // Shorter wait times for Resend
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error('❌ All Resend email attempts failed. Last error:', lastError?.message);
  throw new Error(`Failed to send confirmation email via Resend: ${lastError?.message}`);
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
        isProfileComplete: false,
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
    
    const recentVerification = await publicDb.adminOTP.findFirst({
      where: {
        identifier: phoneNumber,
        type: 'phone',
        usedAt: { not: null },
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
  console.log('🚀 Starting Railway admin registration with Resend...');
  
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

    console.log('📥 Railway registration request:', {
      firstname,
      lastname,
      email,
      phonenumber,
      role,
      phoneVerified,
      hasDatabase: !!database
    });

    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const isEmailRegistration = !!email;
    const isPhoneRegistration = !!phonenumber && !email;

    console.log('📝 Registration method:', isEmailRegistration ? 'EMAIL' : 'PHONE');

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

    const adminEmail = email || `${phonenumber}@phone.local`;
    const schemaName = database?.name || generateSchemaName(firstname, lastname);
    
    const schemaConfig = {
      name: schemaName,
      displayName: database?.displayName || `${firstname} ${lastname}'s Workspace`,
      description: database?.description || `Workspace managed by ${firstname} ${lastname}`,
      maxUsers: database?.maxUsers || 1000,
      maxStorage: database?.maxStorage || 10.0
    };

    const hashedPassword = await bcrypt.hash(password, 12);

    let createdAdmin: any;
    let adminUser: any;
    let confirmationRecord: any;

    try {
      const confirmationToken = isEmailRegistration ? crypto.randomUUID() : null;
      const tokenExpiry = isEmailRegistration ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

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

      if (isPhoneRegistration) {
        console.log('📱 Updating OTP record with admin ID...');
        
        await publicDb.adminOTP.updateMany({
          where: {
            identifier: phonenumber,
            type: 'phone',
            usedAt: { not: null },
            adminId: null
          },
          data: {
            adminId: createdAdmin.id
          }
        });
        
        console.log('✅ Phone OTP record updated with admin ID');
      }

      console.log('🗄️ Creating schema...');
      await createSchema(schemaName);

      console.log('📋 Applying schema migrations...');
      await applySchemaToNewSchema(schemaName);

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
        isPhoneRegistration
      );
      
      adminUser = initResult.adminUser;

      if (isEmailRegistration && confirmationToken) {
        console.log('📧 Sending confirmation email via Resend...');
        try {
          await sendConfirmationEmail(
            adminEmail, 
            confirmationToken, 
            `${firstname} ${lastname}`
          );
          console.log('✅ Resend confirmation email sent successfully');
        } catch (emailError: any) {
          console.error('❌ Resend email failed:', emailError.message);
          console.warn('⚠️ Registration completed but confirmation email failed. Admin can request a new confirmation email.');
        }
      }

      if (isPhoneRegistration) {
        console.log('📱 Auto-confirming phone registration...');
        await publicDb.admin.update({
          where: { id: createdAdmin.id },
          data: { 
            isActive: true,
          }
        });
        console.log('✅ Phone registration auto-confirmed');
      }

    } catch (error: any) {
      console.error('❌ Railway registration process failed:', error.message);
      
      // Cleanup logic
      try {
        console.log('🧹 Attempting Railway cleanup...');
        
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
        
        console.log('✅ Railway cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Railway cleanup failed:', cleanupError);
      }
      
      throw error;
    }

    console.log('🎉 Railway admin registration completed successfully!');

    if (isEmailRegistration && confirmationRecord) {
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
    console.error('❌ Railway admin registration error:', error);

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