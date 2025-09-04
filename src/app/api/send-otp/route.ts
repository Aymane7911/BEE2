// app/api/send-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publicDb } from '@/lib/database-connection';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  initializeApp({
    credential: cert(serviceAccount as any),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// Fallback SMS function for development/testing
async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    // This could be replaced with actual SMS service like Twilio
    console.log(`📱 SMS to ${phoneNumber}: ${message}`);
    return true;
  } catch (error) {
    console.error('SMS sending failed:', error);
    return false;
  }
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, adminId, useFirebase = true } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number format
    const normalizedPhone = phoneNumber.replace(/\s+/g, '');
    
    // Validate phone number format (basic validation)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format. Please include country code (e.g., +971501234567)' },
        { status: 400 }
      );
    }

    if (useFirebase) {
      try {
        // Firebase handles OTP generation and sending automatically
        // We just need to store a record for tracking purposes
        console.log('Firebase OTP requested for:', normalizedPhone);

        // Delete any existing OTP records for this phone number
        await publicDb.adminOTP.deleteMany({
          where: {
            identifier: normalizedPhone,
            type: 'phone'
          }
        });

        // Create a tracking record (Firebase will handle the actual OTP)
        await publicDb.adminOTP.create({
          data: {
            adminId: adminId || null,
            identifier: normalizedPhone,
            type: 'phone',
            otp: 'FIREBASE_HANDLED', // Firebase manages the actual OTP
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            attempts: 0
          }
        });

        return NextResponse.json({
          success: true,
          message: 'OTP will be sent via Firebase',
          useFirebase: true
        });

      } catch (firebaseError) {
        console.error('Firebase OTP error:', firebaseError);
        // Fall back to manual SMS if Firebase fails
        console.log('Falling back to manual SMS...');
      }
    }

    // Fallback: Manual OTP generation and SMS sending
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete any existing OTP records for this phone number
    await publicDb.adminOTP.deleteMany({
      where: {
        identifier: normalizedPhone,
        type: 'phone'
      }
    });

    // Store OTP in database
    await publicDb.adminOTP.create({
      data: {
        adminId: adminId || null,
        identifier: normalizedPhone,
        type: 'phone',
        otp,
        expiresAt,
        attempts: 0
      }
    });

    // Send SMS
    const message = `Your verification code is: ${otp}. This code expires in 5 minutes.`;
    const smsSent = await sendSMS(normalizedPhone, message);

    if (!smsSent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      useFirebase: false
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}