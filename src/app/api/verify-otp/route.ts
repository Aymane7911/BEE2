// app/api/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publicDb } from '@/lib/database-connection';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json();
    
    // Enhanced logging
    console.log('=== OTP VERIFICATION DEBUG ===');
    console.log('Received phoneNumber:', phoneNumber);
    console.log('Received OTP:', otp);
    console.log('OTP type:', typeof otp);

    if (!phoneNumber || !otp) {
      console.log('Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Normalize phone number (remove spaces, ensure consistent format)
    const normalizedPhone = phoneNumber.replace(/\s+/g, '');
    console.log('Normalized phone:', normalizedPhone);

    // Find ALL OTP records for this phone number (for debugging)
    const allOtpRecords = await publicDb.adminOTP.findMany({
      where: {
        identifier: normalizedPhone,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('All OTP records for this phone:', allOtpRecords);

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

    // Check if OTP is expired
    const now = new Date();
    console.log('Current time:', now);
    console.log('OTP expires at:', otpRecord.expiresAt);
    console.log('Is expired?', now > otpRecord.expiresAt);

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
    console.log('Stored OTP:', otpRecord.otp);
    console.log('Received OTP:', otp);
    console.log('OTP match?', otpRecord.otp === otp);
    console.log('Stored OTP type:', typeof otpRecord.otp);
    console.log('Received OTP type:', typeof otp);

    // Convert both to strings for comparison
    const storedOtpStr = String(otpRecord.otp);
    const receivedOtpStr = String(otp);
    console.log('String comparison:', storedOtpStr === receivedOtpStr);

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

    console.log('OTP verified successfully - marking as used');
    // Mark as used
    await publicDb.adminOTP.update({
      where: { id: otpRecord.id },
      data: { 
        usedAt: new Date()
      }
    });

    console.log('=== OTP VERIFICATION SUCCESS ===');
    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}