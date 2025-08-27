'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion, useAnimation, useInView } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { easeInOut } from "framer-motion";

export default function Hero() {
  const [showDetails, setShowDetails] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(''); // 'success', 'error', or ''
  const router = useRouter();

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px 0px" });

  const controls = useAnimation();

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [inView, controls]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: string | number | NodeJS.Timeout | undefined;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as "spring",
      damping: 20,
      stiffness: 100,
    },
  },
};

  const floatingAnimation = {
  y: [0, -20, 0],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: easeInOut
  }
};

  // Phone number formatting
  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: { target: { value: string; }; }) => {
    const formattedPhoneNumber = formatPhoneNumber(e.target.value);
    setPhoneNumber(formattedPhoneNumber);
  };

  const sendOTP = async () => {
    if (phoneNumber.length < 14) { // (XXX) XXX-XXXX format
      alert('Please enter a valid phone number');
      return;
    }

    setIsVerifying(true);
    
    try {
      // Simulate API call to send OTP
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real app, you would call your OTP service here
      // const response = await fetch('/api/send-otp', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ phoneNumber: phoneNumber.replace(/[^\d]/g, '') })
      // });
      
      setOtpSent(true);
      setCountdown(60); // 60 second countdown
      alert('OTP sent successfully!');
    } catch (error) {
      alert('Failed to send OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      alert('Please enter a 6-digit OTP');
      return;
    }

    setIsVerifying(true);
    
    try {
      // Simulate API call to verify OTP
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, you would verify the OTP here
      // const response = await fetch('/api/verify-otp', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ 
      //     phoneNumber: phoneNumber.replace(/[^\d]/g, ''), 
      //     otp: otp 
      //   })
      // });
      
      // For demo purposes, accept any 6-digit code
      alert('Phone number verified successfully!');
      setShowPhoneAuth(false);
      setOtpSent(false);
      setPhoneNumber('');
      setOtp('');
      // Redirect to dashboard or complete registration
      router.push('/dashboard');
    } catch (error) {
      alert('Invalid OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const resendOTP = () => {
    if (countdown === 0) {
      sendOTP();
    }
  };

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSubmitting(true);
  setSubmitStatus('');
  
  // Use e.currentTarget instead of e.target for proper typing
  const formData = new FormData(e.currentTarget);
  
  try {
    const response = await fetch('https://formspree.io/f/xkgvwyke', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      setSubmitStatus('success');
      e.currentTarget.reset(); // Clear the form
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus('');
      }, 5000);
    } else {
      setSubmitStatus('error');
    }
  } catch (error) {
    setSubmitStatus('error');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleGoogleAuth = () => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const state = 'google_auth_' + Math.random().toString(36).substring(2, 15);
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${googleClientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `access_type=offline&` +
      `state=google_auth`;
    
    window.location.href = googleAuthUrl;
  };

  const handleLinkedInAuth = () => {
    const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `client_id=YOUR_LINKEDIN_CLIENT_ID&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/linkedin/callback')}&` +
      `response_type=code&` +
      `scope=r_liteprofile r_emailaddress&` +
      `state=linkedin_auth`;
    
    window.location.href = linkedinAuthUrl;
  };

  // Phone Auth Modal Component
  const PhoneAuthModal = () => (
    <AnimatePresence>
      {showPhoneAuth && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowPhoneAuth(false)}
        >
          <motion.div
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                {otpSent ? 'Verify OTP' : 'Phone Authentication'}
              </h3>
              <p className="text-gray-600">
                {otpSent 
                  ? `Enter the 6-digit code sent to ${phoneNumber}` 
                  : 'Enter your phone number to receive an OTP'
                }
              </p>
            </div>

            {!otpSent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-lg"
                    maxLength={14}
                  />
                </div>
                <motion.button
                  onClick={sendOTP}
                  disabled={isVerifying || phoneNumber.length < 14}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isVerifying ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Sending...
                    </div>
                  ) : (
                    'Send OTP'
                  )}
                </motion.button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-lg text-center tracking-widest"
                    maxLength={6}
                  />
                </div>
                
                <motion.button
                  onClick={verifyOTP}
                  disabled={isVerifying || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isVerifying ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </div>
                  ) : (
                    'Verify OTP'
                  )}
                </motion.button>

                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Didn't receive the code?
                  </p>
                  <button
                    onClick={resendOTP}
                    disabled={countdown > 0}
                    className="text-yellow-600 hover:text-yellow-700 font-semibold text-sm disabled:text-gray-400"
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPhoneAuth(false);
                  setOtpSent(false);
                  setPhoneNumber('');
                  setOtp('');
                  setCountdown(0);
                }}
                className="w-full text-gray-600 hover:text-gray-800 font-medium py-2 transition-colors duration-300"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <main className="flex flex-col items-center justify-center text-white bg-black">
      {/* Phone Auth Modal */}
      <PhoneAuthModal />

      {/* Enhanced Hero Section */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center text-center">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
        >
          <source src="/bee_keeper.mp4" type="video/mp4" />
        </video>

        {/* Enhanced overlay with gradient */}
        <motion.div
          className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/40 via-black/60 to-black/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
        />

        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [-20, -100, -20],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Enhanced Header with Honey Certify Logo */}
        <motion.div
          className={`fixed top-0 left-0 right-0 z-50 p-5 transition-all duration-300 ${
            isScrolled ? 'bg-black/90 backdrop-blur-md border-b border-yellow-500/20' : ''
          }`}
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <motion.div 
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🍯</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-yellow-400">Honey Certify</h1>
                <p className="text-xs text-gray-400">Blockchain Verification</p>
              </div>
            </motion.div>

            <div className="flex gap-3">
              <motion.button
                onClick={() => router.push('/login')}
                className="bg-transparent border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-semibold py-2 px-6 rounded-full transition-all duration-300 backdrop-blur-sm"
                whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(234, 179, 8, 0.5)" }}
                whileTap={{ scale: 0.95 }}
              >
                Login
              </motion.button>
              <motion.button
                onClick={() => router.push('/register')}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold py-2 px-6 rounded-full transition-all duration-300 shadow-lg"
                whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(234, 179, 8, 0.6)" }}
                whileTap={{ scale: 0.95 }}
              >
                Register
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Main Content */}
        <motion.div
          className="relative z-10 px-4 max-w-7xl w-full flex flex-col lg:flex-row justify-center items-center gap-16"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="max-w-3xl text-center lg:text-left">
            <AnimatePresence mode="wait">
              {!showDetails ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.8 }}
                  className="space-y-6"
                >
                  <motion.h1 
                    className="text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 bg-clip-text text-transparent leading-tight"
                    animate={{ 
                      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    }}
                    transition={{ duration: 5, repeat: Infinity }}
                  >
                    Certify Your Honey. Gain Trust. Get Verified.
                  </motion.h1>
                  <motion.p 
                    className="text-2xl mb-10 text-gray-200 leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 0.8 }}
                  >
                    Blockchain-backed certification for honey producers. Earn customer trust with verified reports and transparent quality assurance.
                  </motion.p>
                  
                  <motion.div 
                    className="flex flex-col sm:flex-row justify-center lg:justify-start gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5, duration: 0.8 }}
                  >
                    <motion.button
                      onClick={() => router.push('/register')}
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-full text-lg shadow-2xl"
                      whileHover={{ 
                        scale: 1.05, 
                        boxShadow: "0 20px 40px rgba(234, 179, 8, 0.4)",
                        y: -3
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Get Started Free
                    </motion.button>
                    <motion.button
                      onClick={() => setShowDetails(true)}
                      className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 font-bold py-4 px-8 rounded-full text-lg border border-white/20 transition-all duration-300"
                      whileHover={{ 
                        scale: 1.05,
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        y: -3
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Learn More
                    </motion.button>
                  </motion.div>

                  {/* Quick Auth Options */}
                  <motion.div 
                    className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.8, duration: 0.8 }}
                  >
                    <p className="text-gray-300 text-sm mb-2 sm:mb-0 sm:self-center">Quick access:</p>
                    <div className="flex gap-3 justify-center lg:justify-start">
                      <motion.button
                        onClick={() => setShowPhoneAuth(true)}
                        className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 font-medium py-2 px-4 rounded-lg text-sm border border-white/20 transition-all duration-300 flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        📱 Phone
                      </motion.button>
                      <motion.button
                        onClick={handleGoogleAuth}
                        className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 font-medium py-2 px-4 rounded-lg text-sm border border-white/20 transition-all duration-300 flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        🔍 Google
                      </motion.button>
                      <motion.button
                        onClick={handleLinkedInAuth}
                        className="bg-white/10 backdrop-blur-md text-white hover:bg-white/20 font-medium py-2 px-4 rounded-lg text-sm border border-white/20 transition-all duration-300 flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        💼 LinkedIn
                      </motion.button>
                    </div>
                  </motion.div>
                  
                </motion.div>
              ) : (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.8 }}
                  className="space-y-8"
                >
                  <h2 className="text-5xl font-bold mb-8 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    How It Works
                  </h2>
                  <div className="text-left space-y-6">
                    {[
                      { icon: "👤", title: "Register", desc: "Sign up and submit your honey production data with detailed information." },
                      { icon: "🪙", title: "Buy Tokens", desc: "Purchase verification tokens to start the certification process." },
                      { icon: "✅", title: "Verify & Certify", desc: "Upload reports and get blockchain-verified certification." }
                    ].map((step, index) => (
                      <motion.div
                        key={index}
                        className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.2, duration: 0.6 }}
                        whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                      >
                        <div className="text-3xl">{step.icon}</div>
                        <div>
                          <h3 className="text-xl font-bold text-yellow-400 mb-2">{step.title}</h3>
                          <p className="text-gray-200">{step.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <motion.button
                    onClick={() => setShowDetails(false)}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold py-3 px-8 rounded-full"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ← Go Back
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Enhanced Certificate Display */}
          <motion.div 
            className="flex flex-col gap-8 items-center"
            animate={floatingAnimation}
          >
            <motion.div
              className="relative group"
              whileHover={{ scale: 1.1, rotateY: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative bg-white p-6 rounded-lg shadow-2xl">
                <img src="/originbee.png" alt="Origin Certification" className="w-48 h-32 object-contain rounded" />
              </div>
            </motion.div>
            
            <motion.div
              className="relative group"
              whileHover={{ scale: 1.1, rotateY: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative bg-white p-6 rounded-lg shadow-2xl">
                <img src="/premiumbee.png" alt="Premium Certification" className="w-48 h-32 object-contain rounded" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/70 rounded-full mt-2"></div>
          </div>
        </motion.div>
      </section>

      {/* Enhanced Testimonials Section */}
      <motion.section
        ref={ref}
        initial="hidden"
        animate={controls}
        variants={containerVariants}
        className="relative w-full px-6 py-24 overflow-hidden bg-gradient-to-br from-gray-50 to-yellow-50"
      >
        {/* Advanced background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse top-[-100px] left-[-100px]" />
          <div className="absolute w-96 h-96 bg-gradient-to-r from-orange-200 to-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse bottom-[-100px] right-[-100px]" />
          <div className="absolute w-64 h-64 bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>

        <motion.div
          variants={itemVariants}
          className="text-center mb-16 relative z-10"
        >
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-yellow-600 bg-clip-text text-transparent">
            What Our Users Say
          </h2>
          <p className="text-xl text-gray-600">Join thousands of satisfied honey producers worldwide</p>
        </motion.div>

        <div className="max-w-7xl mx-auto grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 relative z-10">
          {[
            {
              name: "Sarah Johnson",
              role: "Organic Honey Producer",
              rating: 5,
              text: "The certification process was seamless and professional. Our customers absolutely love the transparency and trust it brings to our brand!"
            },
            {
              name: "Mike Chen",
              role: "Artisan Beekeeper",
              rating: 5,
              text: "The blockchain verification is revolutionary! It's given our small business the credibility to compete with larger brands."
            },
            {
              name: "Emma Williams",
              role: "Commercial Producer",
              rating: 5,
              text: "Sales increased by 40% after certification. The trust factor is incredible - customers know they're getting authentic honey."
            }
          ].map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative"
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white/50 h-full">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-gray-300 overflow-hidden border-4 border-yellow-400 shadow-lg mr-4">
                    {/* Profile image placeholder - replace with actual images */}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">{testimonial.name}</h4>
                    <p className="text-gray-600 text-sm">{testimonial.role}</p>
                  </div>
                </div>
                
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i, duration: 0.3 }}
                    >
                      ⭐
                    </motion.div>
                  ))}
                </div>
                
                <p className="text-gray-700 italic leading-relaxed text-lg">
                  "{testimonial.text}"
                </p>
                
                <div className="absolute top-4 right-4 text-6xl text-yellow-400/20 font-serif">
                  "
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats section */}
        <motion.div
          variants={itemVariants}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center relative z-10"
        >
          {[
            { number: "10,000+", label: "Certified Producers" },
            { number: "99.9%", label: "Trust Rating" },
            { number: "50+", label: "Countries" },
            { number: "24/7", label: "Support" }
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-lg border border-white/50"
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.9)" }}
            >
              <div className="text-3xl font-bold text-yellow-600 mb-2">{stat.number}</div>
              <div className="text-gray-600 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>
    
      {/* Contact Us Section */}
      <motion.section
        className="relative w-full px-6 py-24 bg-gradient-to-br from-gray-900 via-black to-gray-800 overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full filter blur-3xl animate-pulse top-[-100px] right-[-100px]" />
          <div className="absolute w-96 h-96 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-full filter blur-3xl animate-pulse bottom-[-100px] left-[-100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Get In Touch
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Have questions about honey certification? We're here to help you get started with blockchain verification.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Contact Form */}
            <motion.div
              className="relative group"
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20">
                {/* Notification Messages */}
                <AnimatePresence>
                  {submitStatus === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.9 }}
                      className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">✅</div>
                        <div>
                          <h4 className="text-green-400 font-semibold">Message Sent Successfully!</h4>
                          <p className="text-green-300 text-sm">Thanks for reaching out. We'll get back to you within 24 hours.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {submitStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.9 }}
                      className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">❌</div>
                        <div>
                          <h4 className="text-red-400 font-semibold">Failed to Send Message</h4>
                          <p className="text-red-300 text-sm">Please try again or contact us directly at ayman.inpt@gmail.com</p>
                        </div>
                        <button
                          onClick={() => setSubmitStatus('')}
                          className="ml-auto text-red-400 hover:text-red-300 text-xl leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form 
                  className="space-y-6"
                  onSubmit={handleContactSubmit}
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                        placeholder="Your first name"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                        placeholder="Your last name"
                      />
                    </motion.div>
                  </div>
                  
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                      placeholder="your.email@example.com"
                    />
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                      placeholder="+971 50 123 4567"
                    />
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company/Organization
                    </label>
                    <input
                      type="text"
                      name="company"
                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                      placeholder="Your company name"
                    />
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subject *
                    </label>
                    <select
                      name="subject"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300"
                    >
                      <option value="" className="bg-gray-800">Select a topic...</option>
                      <option value="certification" className="bg-gray-800">Certification Process</option>
                      <option value="pricing" className="bg-gray-800">Pricing & Packages</option>
                      <option value="technical" className="bg-gray-800">Technical Support</option>
                      <option value="partnership" className="bg-gray-800">Partnership Opportunities</option>
                      <option value="other" className="bg-gray-800">Other</option>
                    </select>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      rows={5}
                      name="message"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300 resize-vertical"
                      placeholder="Tell us how we can help you..."
                    ></textarea>
                  </motion.div>

                  {/* Hidden input for form identification */}
                  <input type="hidden" name="_subject" value="New Contact Form Submission - Honey Certify" />
                  <input type="hidden" name="_replyto" value="ayman.inpt@gmail.com" />

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-500 disabled:to-gray-600 text-black font-bold py-4 px-8 rounded-lg text-lg shadow-xl transition-all duration-300"
                    whileHover={!isSubmitting ? { 
                      scale: 1.02, 
                      boxShadow: "0 20px 40px rgba(234, 179, 8, 0.4)" 
                    } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                        Sending Message...
                      </div>
                    ) : (
                      'Send Message'
                    )}
                  </motion.button>

                  <p className="text-sm text-gray-400 text-center">
                    We typically respond within 24 hours
                  </p>
                </form>
              </div>
            </motion.div>

            {/* Contact Information */}
            <motion.div
              className="space-y-8"
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <div className="text-center lg:text-left">
                <h3 className="text-3xl font-bold text-white mb-6">
                  Let's Start a Conversation
                </h3>
                <p className="text-gray-300 text-lg leading-relaxed mb-8">
                  Ready to revolutionize your honey business with blockchain certification? 
                  Our team of experts is here to guide you through every step of the process.
                </p>
              </div>

              {/* Contact Cards */}
              <div className="space-y-4">
                {[
                  {
                    icon: "📧",
                    title: "Email Us",
                    detail: "ayman.inpt@gmail.com",
                    description: "Get answers to your questions"
                  },
                  {
                    icon: "📞",
                    title: "Call Us",
                    detail: "+971 50 123 4567",
                    description: "Speak with our certification experts"
                  },
                  {
                    icon: "💬",
                    title: "Live Chat",
                    detail: "Available 24/7",
                    description: "Instant support when you need it"
                  },
                  {
                    icon: "📍",
                    title: "Visit Us",
                    detail: "Sharjah, UAE",
                    description: "Schedule an in-person meeting"
                  }
                ].map((contact, index) => (
                  <motion.div
                    key={index}
                    className="group bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-all duration-300"
                    whileHover={{ 
                      scale: 1.02, 
                      backgroundColor: "rgba(255, 255, 255, 0.1)" 
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{contact.icon}</div>
                      <div>
                        <h4 className="text-xl font-semibold text-white mb-1">
                          {contact.title}
                        </h4>
                        <p className="text-yellow-400 font-medium text-lg mb-1">
                          {contact.detail}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {contact.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Social Links */}
              <motion.div
                className="text-center lg:text-left pt-8"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                viewport={{ once: true }}
              >
                <h4 className="text-lg font-semibold text-white mb-4">Follow Us</h4>
                <div className="flex justify-center lg:justify-start gap-4">
                  {[
                    { icon: "🐦", label: "Twitter" },
                    { icon: "📘", label: "Facebook" },
                    { icon: "💼", label: "LinkedIn" },
                    { icon: "📸", label: "Instagram" }
                  ].map((social, index) => (
                    <motion.button
                      key={index}
                      className="w-12 h-12 bg-white/10 hover:bg-yellow-500/20 rounded-full flex items-center justify-center text-xl border border-white/20 hover:border-yellow-500/50 transition-all duration-300"
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      title={social.label}
                    >
                      {social.icon}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-black border-t border-yellow-500/20 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-lg">🍯</span>
            </div>
            <span className="text-xl font-bold text-yellow-400">Honey Certify</span>
          </div>
          <p className="text-gray-400 text-sm">
            © 2025 Honey Certify. All rights reserved. | Blockchain-powered honey certification.
          </p>
        </div>
      </footer>
    </main>
  );
}