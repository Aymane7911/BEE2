'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRegistrationPage() {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phonenumber: '',
    password: '',
    confirmPassword: '',
    adminCode: '',
    role: 'admin', // Default role
    useEmail: true,
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleAuth = () => {
    setFormData(prev => ({ ...prev, useEmail: !prev.useEmail }));
  };

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Build the Google OAuth URL with proper parameters
      const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
      const params = new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        redirect_uri: `${window.location.origin}/api/auth/google/callback`,
        response_type: 'code',
        scope: 'email profile openid',
        access_type: 'offline',
        prompt: 'consent',
        state: JSON.stringify({
          type: 'admin',
          redirectTo: '/admin/dashboard'
        })
      });
      
      const googleAuthUrl = `${baseUrl}?${params.toString()}`;
      
      // Open in current window
      window.location.href = googleAuthUrl;
    } catch (err) {
      console.error('Google OAuth error:', err);
      setError('Failed to initialize Google authentication.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (!formData.adminCode) {
      setError('Admin authorization code is required');
      setIsLoading(false);
      return;
    }

    if (formData.useEmail && !formData.email) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }

    if (!formData.useEmail && !formData.phonenumber) {
      setError('Phone number is required');
      setIsLoading(false);
      return;
    }

    const { firstname, lastname, email, phonenumber, password, adminCode, role, useEmail } = formData;

    try {
      const endpoint = '/api/admin/register';
      
      // Admin registration payload
      const payload = {
        firstname,
        lastname,
        password,
        adminCode,
        role,
        ...(useEmail ? { email } : { phonenumber }),
        // Database details for admin registration
        database: {
          name: `${firstname.toLowerCase()}_${lastname.toLowerCase()}_db`,
          displayName: `${firstname} ${lastname}'s Database`,
          maxUsers: 1000,
          maxStorage: 10.0
        }
      };

      console.log('Final payload being sent:', payload);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log('Admin registration successful:', data);
        
        // Check if email confirmation is required
        if (data.requiresConfirmation) {
          setSuccess(`Registration successful! Please check your ${useEmail ? 'email' : 'phone'} for confirmation instructions.`);
          // Don't redirect yet - wait for confirmation
        } else {
          setSuccess('Admin account created successfully! Redirecting...');
          setTimeout(() => {
            router.push('/admin/dashboard');
          }, 2000);
        }
      } else {
        setError(data?.error || data?.message || 'Admin registration failed. Please try again.');
        console.error('Admin registration failed:', data);
      }
    } catch (err) {
      console.error('Network or unexpected error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 transition-all duration-1000 bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900">
        {/* Floating Shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-16 h-16 transform rotate-45 animate-pulse transition-colors duration-1000 bg-blue-400/20"></div>
          <div className="absolute top-32 right-20 w-12 h-12 transform rotate-12 animate-bounce transition-colors duration-1000 bg-indigo-300/30"></div>
          <div className="absolute bottom-20 left-1/4 w-20 h-20 transform -rotate-45 animate-pulse delay-300 transition-colors duration-1000 bg-slate-300/15"></div>
          <div className="absolute top-1/3 right-1/3 w-8 h-8 transform rotate-30 animate-bounce delay-700 transition-colors duration-1000 bg-blue-300/25"></div>
          <div className="absolute bottom-1/3 right-10 w-14 h-14 transform rotate-60 animate-pulse delay-500 transition-colors duration-1000 bg-indigo-400/20"></div>
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5"></div>
      </div>

      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <pattern id="circuit" x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse">
              <rect width="25" height="25" fill="none"/>
              <circle cx="5" cy="5" r="1" fill="currentColor"/>
              <circle cx="20" cy="5" r="1" fill="currentColor"/>
              <circle cx="5" cy="20" r="1" fill="currentColor"/>
              <circle cx="20" cy="20" r="1" fill="currentColor"/>
              <path d="M5,5 L20,5 M5,20 L20,20 M5,5 L5,20 M20,5 L20,20" stroke="currentColor" strokeWidth="0.5" fill="none"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit)" className="text-blue-200"/>
        </svg>
      </div>

      {/* Logo - Clickable */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in">
        <div 
          className="relative cursor-pointer transition-transform hover:scale-105"
          onClick={() => router.push('/')}
        >
          <div className="absolute inset-0 blur-xl rounded-xl transition-colors duration-1000 bg-blue-500/20"></div>
          <div className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-1000 bg-gradient-to-br from-blue-500 to-indigo-600">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Admin Portal</h1>
                <p className="text-xs text-gray-200">System Management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 pt-32 pb-8">
        <div className="w-full max-w-lg">
          {/* Register Card */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-all duration-1000 group-hover:duration-200 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-500"></div>
            
            {/* Card */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 transform hover:scale-[1.02] transition-all duration-300">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4 transition-all duration-1000 bg-gradient-to-br from-blue-500 to-indigo-600">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent mb-2 transition-all duration-1000 bg-gradient-to-r from-blue-600 to-indigo-600">
                  Admin Registration
                </h1>
                <p className="text-gray-600 text-lg">
                  Create administrator account & database
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="relative overflow-hidden bg-red-50 border border-red-200 rounded-xl p-4 animate-slide-down mb-6">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-500 animate-pulse"></div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="relative overflow-hidden bg-green-50 border border-green-200 rounded-xl p-4 animate-slide-down mb-6">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-500 animate-pulse"></div>
                </div>
              )}

              {/* Form */}
              <div className="space-y-6">
                {/* Google OAuth Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 hover:bg-gray-100 border border-gray-200 font-semibold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {isLoading ? 'Connecting...' : 'Continue with Google (Admin)'}
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">Or register manually</span>
                  </div>
                </div>

                {/* Admin Authorization Code */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    name="adminCode"
                    value={formData.adminCode}
                    onChange={handleChange}
                    placeholder="Enter admin authorization code"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    required
                  />
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="firstname"
                      value={formData.firstname}
                      onChange={handleChange}
                      placeholder="First name"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      required
                    />
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="lastname"
                      value={formData.lastname}
                      onChange={handleChange}
                      placeholder="Last name"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      required
                    />
                  </div>
                </div>

                {/* Toggle Between Email and Phone */}
                <div className="flex items-center justify-center mb-4">
                  <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, useEmail: true }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        formData.useEmail 
                          ? 'bg-blue-500 text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      📧 Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, useEmail: false }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        !formData.useEmail 
                          ? 'bg-blue-500 text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      📱 Phone
                    </button>
                  </div>
                </div>

                {/* Email or Phone Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {formData.useEmail ? (
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type={formData.useEmail ? "email" : "tel"}
                    name={formData.useEmail ? "email" : "phonenumber"}
                    value={formData.useEmail ? formData.email : formData.phonenumber}
                    onChange={handleChange}
                    placeholder={formData.useEmail ? "Enter your email" : "Enter your phone number"}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    required
                  />
                </div>

                {/* Password Fields */}
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create password"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      required
                    />
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm password"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      required
                    />
                  </div>
                </div>

                {/* Admin Role Selection */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 appearance-none"
                    required
                  >
                    <option value="admin">System Administrator</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  <div className="flex items-center justify-center">
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Admin Account...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Create Admin Account
                      </>
                    )}
                  </div>
                </button>

                {/* Login Link */}
                <div className="text-center">
                  <p className="text-gray-600">
                    Already have an admin account?{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/admin/login')}
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
                    >
                      Sign in here
                    </button>
                  </p>
                </div>

                {/* Terms and Privacy */}
                <div className="text-center">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    By creating an admin account, you agree to our{' '}
                    <a href="/terms" className="text-blue-600 hover:text-blue-500 transition-colors">Terms of Service</a>{' '}
                    and{' '}
                    <a href="/privacy" className="text-blue-600 hover:text-blue-500 transition-colors">Privacy Policy</a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info Card */}
          <div className="mt-8 relative group">
            <div className="absolute -inset-1 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-all duration-1000 bg-gradient-to-r from-indigo-400 via-purple-500 to-indigo-500"></div>
            <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-500 to-purple-600">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Administrator Benefits</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>✨ Full system access and control</p>
                  <p>🗄️ Dedicated database instance</p>
                  <p>👥 Manage up to 1,000 users</p>
                  <p>💾 10GB storage allocation</p>
                  <p>📊 Advanced analytics dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-8">
        <div className="text-center">
          <p className="text-white/70 text-sm">
            © 2024 Admin Portal. All rights reserved.
          </p>
        </div>
      </div>
    </section>
  );
}