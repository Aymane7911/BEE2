'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion, useAnimation, useInView } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { easeInOut } from "framer-motion";

export default function Hero() {
  const [showDetails, setShowDetails] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  const handleGoogleAuth = () => {
    // Google OAuth 2.0 implementation
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;; // Replace with your actual Google Client ID (not secret)
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const state = 'google_auth_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('oauth_state', state);

    
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
    // LinkedIn OAuth 2.0 implementation
    const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `client_id=YOUR_LINKEDIN_CLIENT_ID&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/linkedin/callback')}&` +
      `response_type=code&` +
      `scope=r_liteprofile r_emailaddress&` +
      `state=linkedin_auth`;
    
    window.location.href = linkedinAuthUrl;
  };

  return (
    <main className="flex flex-col items-center justify-center text-white bg-black">
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
                      🚀 Get Started Free
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
                      ✨ Learn More
                    </motion.button>
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
                      { icon: "🐝", title: "Register", desc: "Sign up and submit your honey production data with detailed information." },
                      { icon: "💰", title: "Buy Tokens", desc: "Purchase verification tokens to start the certification process." },
                      { icon: "🔒", title: "Verify & Certify", desc: "Upload reports and get blockchain-verified certification." }
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
    </main>
  );
}