// app/api/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publicDb } from '@/lib/database-connection';

// DO NOT import Firebase at module level during build
// We'll import it dynamically only when needed

// Firebase initialization function - only called when needed
async function getFirebaseAdmin() {
  // Only initialize if we're not in build mode
  if (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Firebase not configured for production');
  }

  try {
    // Dynamic import to prevent build-time execution
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    
    const apps = getApps();
    if (apps.length > 0) {
      return apps[0];
    }

    // Validate required environment variables
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    // Ensure project_id is a string (the error you're getting)
    if (!serviceAccount.project_id || typeof serviceAccount.project_id !== 'string') {
      throw new Error('Firebase project_id must be a non-empty string');
    }

    return initializeApp({
      credential: cert(serviceAccount as any),
      projectId: serviceAccount.project_id,
    });

  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
    throw new Error(`Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp, firebaseIdToken } = await request.json();
    
    console.log('=== OTP VERIFICATION DEBUG ===');
    console.log('Received phoneNumber:', phoneNumber);
    console.log('Received OTP:', otp);
    console.log('Firebase ID Token provided:', !!firebaseIdToken);

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\s+/g, '');
    console.log('Normalized phone:', normalizedPhone);

    // Check if we have a Firebase ID token (indicates Firebase verification was used)
    if (firebaseIdToken) {
      try {
        console.log('Verifying Firebase ID token...');
        
        // Initialize Firebase only when needed and dynamically import getAuth
        const firebaseApp = await getFirebaseAdmin();
        const { getAuth } = await import('firebase-admin/auth');
        const auth = getAuth(firebaseApp);
        
        const decodedToken = await auth.verifyIdToken(firebaseIdToken);
        
        console.log('Firebase token verified successfully');
        console.log('Token phone number:', decodedToken.phone_number);
        
        // Verify the phone number matches
        if (decodedToken.phone_number !== normalizedPhone) {
          console.log('Phone number mismatch in token');
          return NextResponse.json(
            { success: false, error: 'Phone number verification failed' },
            { status: 400 }
          );
        }

        // Update our database record to mark as verified
        await publicDb.adminOTP.updateMany({
          where: {
            identifier: normalizedPhone,
            type: 'phone',
            usedAt: null
          },
          data: {
            usedAt: new Date(),
            otp: 'FIREBASE_VERIFIED'
          }
        });

        console.log('=== FIREBASE VERIFICATION SUCCESS ===');
        return NextResponse.json({
          success: true,
          message: 'Phone number verified successfully via Firebase',
          method: 'firebase'
        });

      } catch (firebaseError) {
        console.error('Firebase token verification failed:', firebaseError);
        // Fallback to manual OTP verification if Firebase fails
        console.log('Firebase verification failed, falling back to manual OTP...');
      }
    }

    // Fallback to manual OTP verification
    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'OTP is required for manual verification' },
        { status: 400 }
      );
    }

    console.log('Using manual OTP verification...');

    // Try different phone number formats to match
    const phoneFormats = [
      normalizedPhone,
      phoneNumber, // Original format
      phoneNumber.replace(/\s+/g, ''), // Without spaces
      phoneNumber.replace(/[^\d+]/g, ''), // Only digits and +
    ];

    console.log('Trying phone formats:', phoneFormats);

    // Find the most recent unused OTP record for this phone number
    let otpRecord = null;
    for (const format of phoneFormats) {
      otpRecord = await publicDb.adminOTP.findFirst({
        where: {
          identifier: format,
          type: 'phone',
          usedAt: null // Not used yet
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (otpRecord) {
        console.log(`Found OTP record with format: ${format}`);
        break;
      }
    }

    console.log('Found OTP record:', otpRecord);

    if (!otpRecord) {
      console.log('No OTP record found');
      return NextResponse.json(
        { success: false, error: 'OTP not found. Please request a new one.' },
        { status: 404 }
      );
    }

    // Check if this is a Firebase-handled record
    if (otpRecord.otp === 'FIREBASE_HANDLED') {
      return NextResponse.json(
        { success: false, error: 'This OTP was issued via Firebase. Please use Firebase verification.' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    const now = new Date();
    console.log('Current time:', now);
    console.log('OTP expires at:', otpRecord.expiresAt);

    if (now > otpRecord.expiresAt) {
      console.log('OTP expired');
      return NextResponse.json(
        { success: false, error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check attempt limit
    console.log('Current attempts:', otpRecord.attempts);
    if (otpRecord.attempts >= 3) {
      console.log('Max attempts exceeded');
      return NextResponse.json(
        { success: false, error: 'Maximum attempts exceeded. Please request a new OTP.' },
        { status: 400 }
      );
    }

    // Check if OTP matches
    const storedOtpStr = String(otpRecord.otp);
    const receivedOtpStr = String(otp);
    console.log('OTP match?', storedOtpStr === receivedOtpStr);

    if (storedOtpStr !== receivedOtpStr) {
      console.log('OTP mismatch - incrementing attempts');
      // Increment attempts
      await publicDb.adminOTP.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 }
      });

      return NextResponse.json(
        { success: false, error: 'Invalid OTP. Please try again.' },
        { status: 400 }
      );
    }

    console.log('Manual OTP verified successfully - marking as used');
    // Mark as used
    await publicDb.adminOTP.update({
      where: { id: otpRecord.id },
      data: { 
        usedAt: new Date()
      }
    });

    console.log('=== MANUAL OTP VERIFICATION SUCCESS ===');
    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
      method: 'manual'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}