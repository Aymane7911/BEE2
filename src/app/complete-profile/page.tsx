'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Cookies from 'js-cookie';
import jwt from 'jsonwebtoken';

interface FormState {
  passportId: string;
  phonenumber: string;
  passportFile: File | null;
  verificationCode: string;
}

export default function CompleteProfilePage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    passportId: '',
    phonenumber: '',
    passportFile: null,
    verificationCode: '',
  });
  
  const [step, setStep] = useState(1); // 1: Phone, 2: Verification, 3: Profile
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 🔁 Redirect if profile is already complete
  useEffect(() => {
    const token = Cookies.get('token');
    if (token) {
      const decoded: any = jwt.decode(token);
      if (decoded?.isProfileComplete) {
        router.replace('/dashboard');
      }
    }
  }, [router]);

  // Countdown timer for resend verification
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('File size must be less than 10MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF and image files (JPEG, JPG, PNG) are allowed');
        return;
      }
    }
    setForm(prev => ({ ...prev, passportFile: file || null }));
    setError('');
  };

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
  };

  const sendVerificationCode = async () => {
    if (!validatePhoneNumber(form.phonenumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('action', 'send_verification');
    formData.append('phonenumber', form.phonenumber);

    try {
      const res = await fetch('/api/complete-profile', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await res.json();

      if (res.ok) {
        setSuccess('Verification code sent to your phone!');
        setStep(2);
        setCountdown(60); // 60 second cooldown
      } else {
        setError(result.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyPhone = async () => {
    if (!form.verificationCode || form.verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('action', 'verify_phone');
    formData.append('verificationCode', form.verificationCode);

    try {
      const res = await fetch('/api/complete-profile', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await res.json();

      if (res.ok) {
        setSuccess('Phone number verified successfully!');
        setPhoneVerified(true);
        setStep(3);
      } else {
        setError(result.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async () => {
    if (!form.passportId || !form.passportFile) {
      setError('Please provide passport ID and upload passport file');
      return;
    }

    if (!phoneVerified) {
      setError('Phone number must be verified first');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('action', 'complete_profile');
    formData.append('passportId', form.passportId);
    formData.append('passportFile', form.passportFile);

    try {
      const res = await fetch('/api/complete-profile', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (res.ok) {
        const { token } = await res.json();
        Cookies.set('token', token);
        setSuccess('Profile completed successfully! Redirecting...');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 2000);
      } else {
        const result = await res.json();
        setError(result.message || 'Failed to complete profile');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    Cookies.remove('token');
    router.push('/login');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {[1, 2, 3].map((stepNumber) => (
          <div key={stepNumber} className="flex items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-semibold
              ${step >= stepNumber 
                ? 'bg-yellow-500 text-white' 
                : 'bg-gray-300 text-gray-600'
              }
            `}>
              {stepNumber}
            </div>
            {stepNumber < 3 && (
              <div className={`
                w-8 h-1 mx-2
                ${step > stepNumber ? 'bg-yellow-500' : 'bg-gray-300'}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderPhoneStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          name="phonenumber"
          placeholder="1234567890"
          required
          value={form.phonenumber}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-400 rounded-lg text-black focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-600 mt-1">Enter your 10-digit phone number</p>
      </div>

      <button
        type="button"
        onClick={sendVerificationCode}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading || countdown > 0}
      >
        {loading ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Send Verification Code'}
      </button>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-600 mb-4">
          We've sent a 6-digit verification code to <strong>{form.phonenumber}</strong>
        </p>
      </div>

      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Verification Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="verificationCode"
          placeholder="123456"
          maxLength={6}
          required
          value={form.verificationCode}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-400 rounded-lg text-black text-center text-2xl tracking-widest focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
      </div>

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={verifyPhone}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:scale-105 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>
      </div>

      {countdown === 0 && (
        <button
          type="button"
          onClick={sendVerificationCode}
          className="w-full text-yellow-600 hover:text-yellow-700 font-medium"
          disabled={loading}
        >
          Resend Code
        </button>
      )}
    </div>
  );

  const renderProfileStep = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-green-800 font-medium">Phone number verified</p>
        </div>
      </div>

      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Passport ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="passportId"
          placeholder="Enter your passport ID"
          required
          value={form.passportId}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-400 rounded-lg text-black focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Passport File <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={handleFile}
          className="w-full px-4 py-3 border border-gray-400 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
          required
        />
        <p className="text-sm text-gray-600 mt-1">
          Upload PDF or image file (max 10MB). Supported formats: PDF, JPEG, JPG, PNG
        </p>
      </div>

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={completeProfile}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:scale-105 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Uploading...' : 'Complete Profile'}
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-100 via-yellow-200 to-yellow-300 text-gray-800">
      <nav className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 shadow-lg sticky top-0 z-50 rounded-b-xl">
        <div className="flex items-center space-x-2">
          <Image src="/beelogo.png" alt="Honey Certify Logo" width={40} height={40} className="filter grayscale contrast-200 brightness-0" />
          <span className="text-xl font-bold text-black tracking-wide">HoneyCertify</span>
        </div>

        <div className="space-x-6 hidden md:flex">
          <button onClick={() => router.push('/profile')} className="text-black font-medium hover:scale-105 transition-transform duration-200">Profile</button>
          <button onClick={() => router.push('/settings')} className="text-black font-medium hover:scale-105 transition-transform duration-200">Settings</button>
          <button onClick={() => router.push('/about')} className="text-black font-medium hover:scale-105 transition-transform duration-200">About Us</button>
          <button onClick={() => router.push('/contact')} className="text-black font-medium hover:scale-105 transition-transform duration-200">Contact</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-5xl font-bold text-yellow-600 text-center mb-4 animate-fade-in">
          Complete Your Profile 🐝
        </h1>
        <p className="text-center text-lg text-gray-700 mb-12 animate-fade-in delay-100">
          {step === 1 && "Let's verify your phone number first"}
          {step === 2 && "Enter the verification code sent to your phone"}
          {step === 3 && "Now add your passport information to complete your profile"}
        </p>

        {renderStepIndicator()}

        <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition animate-fade-in">
          {step === 1 && renderPhoneStep()}
          {step === 2 && renderVerificationStep()}
          {step === 3 && renderProfileStep()}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition transform hover:scale-105 mt-6"
        >
          Log Out
        </button>
      </div>
    </main>
  );
}