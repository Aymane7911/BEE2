'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ConfirmationResult {
  success: boolean;
  message: string;
  error?: string;
  admin?: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
  };
}

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setResult({
        success: false,
        message: 'Invalid confirmation link',
        error: 'No confirmation token provided'
      });
      setLoading(false);
      return;
    }

    // Call the confirmation API
    confirmEmail(token);
  }, [searchParams]);

  const confirmEmail = async (token: string) => {
    try {
      const response = await fetch('/api/admin/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data: ConfirmationResult = await response.json();
      setResult(data);
      
      // If successful, redirect to login after 3 seconds
      if (data.success) {
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Confirmation failed',
        error: 'Network error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirming Your Account</h2>
            <p className="text-gray-600">Please wait while we verify your email address...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {result?.success ? (
            <>
              {/* Success State */}
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🎉 Email Confirmed!</h2>
              
              <div className="mb-6">
                <p className="text-gray-600 mb-4">{result.message}</p>
                {result.admin && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                    <h3 className="font-semibold text-blue-900 mb-2">Account Details:</h3>
                    <p className="text-sm text-blue-800"><strong>Name:</strong> {result.admin.firstname} {result.admin.lastname}</p>
                    <p className="text-sm text-blue-800"><strong>Email:</strong> {result.admin.email}</p>
                    <p className="text-sm text-blue-800"><strong>Role:</strong> {result.admin.role}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">🔄 Redirecting to login page in 3 seconds...</p>
                <Link href="/login" className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  Go to Login
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Error State */}
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">❌ Confirmation Failed</h2>
              
              <div className="mb-6">
                <p className="text-gray-600 mb-2">{result?.message || 'Unable to confirm your email address.'}</p>
                {result?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-left">
                    <p className="text-sm text-red-800"><strong>Error:</strong> {result.error}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">Possible reasons:</p>
                <ul className="text-xs text-gray-500 text-left space-y-1 mb-6">
                  <li>• The confirmation link has expired (24 hours)</li>
                  <li>• The link has already been used</li>
                  <li>• The link is invalid or corrupted</li>
                </ul>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/register" className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                    Register Again
                  </Link>
                  
                  <Link href="/login" className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors">
                    Try Login
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Need help? Contact{' '}
            <a href="mailto:support@yourapp.com" className="text-blue-600 hover:underline">support@yourapp.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ConfirmEmailContent />
    </Suspense>
  );
}