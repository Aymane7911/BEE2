'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Decode JWT manually
  const decodeJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(base64));
      return decoded;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeJWT(token);
      const currentTime = Date.now() / 1000;
      if (!decoded || decoded.exp < currentTime) {
        localStorage.removeItem('token');
      } else {
        // Redirect to admin dashboard if already logged in
        if (decoded.role === 'admin' || decoded.role === 'super_admin') {
          router.push('/admin/dashboard');
        }
      }
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setErrorMessage('');
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        const token = result.data?.token;
        
        if (token) {
          localStorage.setItem('token', token);
          
          // Store additional admin info if available
          if (result.data?.admin) {
            localStorage.setItem('adminInfo', JSON.stringify(result.data.admin));
          }
          
          router.push('/admin/dashboard');
          setErrorMessage('');
        } else {
          setErrorMessage('Token not received. Please try again.');
        }
      } else {
        setErrorMessage(result.error || result.message || 'Invalid login credentials. Try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
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
          {/* Login Card */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-all duration-1000 group-hover:duration-200 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-500"></div>
            
            {/* Card */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 transform hover:scale-[1.02] transition-all duration-300">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4 transition-all duration-1000 bg-gradient-to-br from-blue-500 to-indigo-600">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent mb-2 transition-all duration-1000 bg-gradient-to-r from-blue-600 to-indigo-600">
                  Admin Access
                </h1>
                <p className="text-gray-600 text-lg">Administrator sign in</p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="relative overflow-hidden bg-red-50 border border-red-200 rounded-xl p-4 animate-slide-down mb-6">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-500 animate-pulse"></div>
                </div>
              )}

              {/* Form */}
              <div className="space-y-6">
                {/* Email Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter admin email"
                    value={credentials.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 text-gray-800 placeholder-gray-500 focus:ring-blue-500"
                  />
                </div>

                {/* Password Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter admin password"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 text-gray-800 placeholder-gray-500 focus:ring-blue-500"
                  />
                </div>

                {/* Login Button */}
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="relative w-full py-4 rounded-xl font-bold text-lg text-white shadow-xl transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {/* Loading Animation */}
                  <div className={`absolute inset-0 bg-gradient-to-r transition-opacity duration-300 ${
                    isLoading ? 'opacity-100' : 'opacity-0'
                  } from-blue-700 via-indigo-600 to-blue-700`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  </div>

                  {/* Button Content */}
                  <span className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                    🛡️ Admin Sign In
                  </span>

                  {/* Shine Effect */}
                  <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transform translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <p className="text-white mb-4">Need an admin account?</p>
              <button
                onClick={() => router.push('/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg border-blue-400 hover:bg-blue-400/20 hover:border-blue-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Request Admin Access
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
      
      {/* Floating Elements */}
      <div className="absolute bottom-10 left-10 opacity-30">
        <div className="w-24 h-24 rounded-full animate-pulse transition-colors duration-1000 bg-blue-300/20"></div>
      </div>
      <div className="absolute bottom-20 right-20 opacity-20">
        <div className="w-16 h-16 rounded-full animate-bounce delay-1000 transition-colors duration-1000 bg-indigo-400/30"></div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </section>
  );
}