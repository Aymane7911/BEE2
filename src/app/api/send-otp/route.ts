// app/api/send-otp/route.ts (Simplified version if you make adminId optional)
import { NextRequest, NextResponse } from 'next/server';
import { publicDb } from '@/lib/database-connection';

async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    // For development/testing - just log the OTP
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
    const { phoneNumber, adminId } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete any existing OTP for this phone number
    await publicDb.adminOTP.deleteMany({
      where: {
        identifier: phoneNumber,
        type: 'phone'
      }
    });

    // Store OTP (adminId can be null for registration flow)
    await publicDb.adminOTP.create({
      data: {
        adminId: adminId || null, // null for registration, actual ID for existing users
        identifier: phoneNumber,
        type: 'phone',
        otp,
        expiresAt,
        attempts: 0
      }
    });

    // Send SMS
    const message = `Your verification code is: ${otp}. This code expires in 5 minutes.`;
    const smsSent = await sendSMS(phoneNumber, message);

    if (!smsSent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}