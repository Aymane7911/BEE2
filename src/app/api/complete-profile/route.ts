import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { uploadFileToPinata, testPinataConnection } from '@/lib/pinata';

const prisma = new PrismaClient();

// JWT verification helper function
function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  } catch (error) {
    return null;
  }
}



// Function to send SMS via Twilio (you can replace with your preferred SMS service)
async function sendVerificationSMS(phoneNumber: string, code: string): Promise<boolean> {
  try {
    // Using Twilio as example - replace with your preferred SMS service
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Twilio credentials not configured');
      return false;
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: phoneNumber,
        Body: `Your HoneyCertify verification code is: ${code}`,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('SMS sending error:', error);
    return false;
  }
}

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value || '';

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Convert userId to number since Prisma expects a number
    const userIdNumber = parseInt(decoded.userId, 10);
    if (isNaN(userIdNumber)) {
      return NextResponse.json({ message: 'Invalid user ID' }, { status: 400 });
    }

    console.log('Decoded User ID:', userIdNumber);

    // Parse form data
    const formData = await req.formData();
    const action = formData.get('action') as string;

    // Handle phone verification request
    if (action === 'send_verification') {
      const phonenumber = formData.get('phonenumber') as string;
      
      if (!phonenumber) {
        return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
      }

      // Validate phone number format
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phonenumber)) {
        return NextResponse.json({ message: 'Invalid phone number format' }, { status: 400 });
      }

      // Generate and store verification code
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code in database
      await prisma.phoneVerification.upsert({
        where: { userId: userIdNumber },
        update: {
          phonenumber,
          code: verificationCode,
          expiresAt,
          isVerified: false,
        },
        create: {
          userId: userIdNumber,
          phonenumber,
          code: verificationCode,
          expiresAt,
          isVerified: false,
        },
      });

      // Send SMS
      const smsSent = await sendVerificationSMS(phonenumber, verificationCode);
      
      if (!smsSent) {
        return NextResponse.json({ 
          message: 'Failed to send verification code. Please try again.' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        message: 'Verification code sent successfully' 
      });
    }

    // Handle verification code confirmation
    if (action === 'verify_phone') {
      const code = formData.get('verificationCode') as string;
      
      if (!code) {
        return NextResponse.json({ message: 'Verification code is required' }, { status: 400 });
      }

      // Check verification code
      const verification = await prisma.phoneVerification.findUnique({
        where: { userId: userIdNumber },
      });

      if (!verification) {
        return NextResponse.json({ message: 'No verification request found' }, { status: 404 });
      }

      if (verification.expiresAt < new Date()) {
        return NextResponse.json({ message: 'Verification code has expired' }, { status: 400 });
      }

      if (verification.code !== code) {
        return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
      }

      // Mark as verified
      await prisma.phoneVerification.update({
        where: { userId: userIdNumber },
        data: { isVerified: true },
      });

      return NextResponse.json({ 
        message: 'Phone number verified successfully' 
      });
    }

    // Handle profile completion
    if (action === 'complete_profile') {
      const passportId = formData.get('passportId') as string;
      const passportFile = formData.get('passportFile') as File;

      // Validate required fields
      if (!passportId || !passportFile) {
        return NextResponse.json({ message: 'Passport ID and file are required' }, { status: 400 });
      }

      // Check if phone is verified
      const verification = await prisma.phoneVerification.findUnique({
        where: { userId: userIdNumber },
      });

      if (!verification || !verification.isVerified) {
        return NextResponse.json({ 
          message: 'Phone number must be verified before completing profile' 
        }, { status: 400 });
      }

      // Validate file type (PDF and images allowed)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(passportFile.type)) {
        return NextResponse.json({ 
          message: 'Only PDF and image files (JPEG, JPG, PNG) are allowed' 
        }, { status: 400 });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (passportFile.size > maxSize) {
        return NextResponse.json({ 
          message: 'File size must be less than 10MB' 
        }, { status: 400 });
      }

      try {
        // Test Pinata connection first
        const isConnected = await testPinataConnection();
        if (!isConnected) {
          throw new Error('Unable to connect to Pinata service');
        }

        // Upload file to Pinata using the helper function
        const ipfsUrl = await uploadFileToPinata(
          passportFile,
          {
            name: `passport-${userIdNumber}-${Date.now()}.${passportFile.name.split('.').pop()}`,
            keyvalues: {
              userId: userIdNumber.toString(),
              type: 'passport',
              uploadDate: new Date().toISOString(),
            }
          },
          {
            cidVersion: 0,
          }
        );

        // Update user profile
        const updatedUser = await prisma.beeusers.update({
          where: { id: userIdNumber },
          data: {
            passportId,
            phonenumber: verification.phonenumber,
            passportFile: ipfsUrl,
            isProfileComplete: true,
          },
        });

        // Generate new token
        const newToken = jwt.sign(
          {
            userId: updatedUser.id.toString(),
            email: updatedUser.email,
            isProfileComplete: true,
          },
          process.env.JWT_SECRET!,
          { expiresIn: '1h' }
        );

        // Create response
        const response = NextResponse.json({
          message: 'Profile completed successfully',
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            isProfileComplete: true,
            passportFile: ipfsUrl,
          }
        });

        // Set new cookie
        response.cookies.set('token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60,
          path: '/',
        });

        return response;
      } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json({ 
          message: 'Failed to upload file. Please try again.' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error completing profile:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}