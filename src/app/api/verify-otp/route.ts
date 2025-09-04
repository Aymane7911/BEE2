// app/api/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publicDb } from '@/lib/database-connection';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK if not already initialized
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
        const auth = getAuth();
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
        return NextResponse.json(
          { success: false, error: 'Invalid verification token' },
          { status: 400 }
        );
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