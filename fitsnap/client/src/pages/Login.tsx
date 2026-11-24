/**
 * Fitsnap Landing Page
 * 
 * Aesthetic: Modern, clean, premium health-tech (Whoop / Oura / Linear / Stripe level).
 * Design Tokens:
 * - Backgrounds: #FFFFFF / #F7F8FA (light sections), #0B0D12 (one dark section max)
 * - Text: #0F172A (primary), #475569 (secondary), #94A3B8 (muted)
 * - Accent: #2F5BFF (single brand blue), Success: #16A34A
 * - Radius: 12px cards, 999px pills/buttons
 * - Typography: Inter for body, Plus Jakarta Sans for headings (letter-spacing -0.02em)
 * - Container: max-w-[1200px], 24px side padding, 12-column grid
 * 
 * Complies with strict restraint: zero neon glows, no gradient text, no heavy blobs,
 * no cut-off elements, full accessibility (WCAG AA), and non-hyperbolic copy.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Zap,
  Flame,
  Droplets,
  Star,
  Menu,
  X,
  Eye,
  EyeOff,
  Smartphone,
  Sparkles,
  TrendingUp,
  Clock,
  SlidersHorizontal,
  Compass,
  ArrowUpRight,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/ui/Toast';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, isLoading } = useAuthStore();

  // Navigation & Mobile Drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Pricing & FAQ Interactive States
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Auth Modal State
  const initialMode = (searchParams.get('mode') as 'signin' | 'signup' | 'forgot') || 'signin';
  const initialEmail = searchParams.get('email') || 'demo@fitsnap.app';
  const shouldAutoOpen = searchParams.get('open') === 'true' || !!searchParams.get('mode') || !!searchParams.get('email');

  const [authModalOpen, setAuthModalOpen] = useState(shouldAutoOpen);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState('');
  const [serverErrorCode, setServerErrorCode] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);

  // Validate fields client-side
  const validateClientSide = () => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    setServerError('');
    setServerErrorCode('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    if (authMode !== 'forgot' && (!password || password.length < 6)) {
      setPasswordError('Password must be at least 6 characters.');
      valid = false;
    }

    return valid;
  };

  // Quick 1-Click Demo Login
  const handleDemoLogin = async () => {
    try {
      setServerError('');
      setServerErrorCode('');
      const result = await login('demo@fitsnap.app', 'password123', true);
      toast.success('Welcome back to Fitsnap!');
      navigate('/dashboard');
    } catch {
      toast.error('Unable to sign in to demo. Please try again.');
    }
  };

  // Forgot password submission
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setIsSubmittingForgot(true);
    setServerError('');
    setForgotSuccess('');

    try {
      const { forgotPassword } = useAuthStore.getState();
      const res = await forgotPassword(email.trim());
      setForgotSuccess(res.message || 'Password reset instructions have been sent.');
      toast.success('Reset email dispatched!');
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Failed to request password reset.');
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  // Auth Form Submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClientSide()) return;

    try {
      if (authMode === 'signin') {
        const result = await login(email.trim(), password, rememberMe);
        toast.success('Welcome back!');
        if (result.isOnboarded) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      } else {
        await register(email.trim(), password);
        toast.success('Account created successfully!');
        navigate('/onboarding');
      }
    } catch (err: any) {
      const code = err.response?.data?.code || '';
      const msg = err.response?.data?.error || err.message || 'Authentication error. Please check your credentials.';
      setServerErrorCode(code);
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] selection:bg-[#2F5BFF] selection:text-white font-sans">

      {/* ── 1. NAVBAR (Sticky, Blurred White) ───────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#0F172A]/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2 group" aria-label="Fitsnap Home">
              <div className="w-8 h-8 rounded-[8px] bg-[#2F5BFF] flex items-center justify-center text-white">
                <Scan className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <span className="text-xl font-bold font-display tracking-tight text-[#0F172A]">
                Fitsnap<span className="text-[#2F5BFF]">.</span>
              </span>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569]">
              <a href="#features" className="hover:text-[#0F172A] transition-colors duration-150">Features</a>
              <a href="#how-it-works" className="hover:text-[#0F172A] transition-colors duration-150">How it works</a>
              <a href="#dashboard" className="hover:text-[#0F172A] transition-colors duration-150">Dashboard</a>
              <a href="#pricing" className="hover:text-[#0F172A] transition-colors duration-150">Pricing</a>
              <a href="#faq" className="hover:text-[#0F172A] transition-colors duration-150">FAQ</a>
            </nav>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Demo Access */}
            <button
              onClick={handleDemoLogin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/15 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Live demo</span>
            </button>

            {/* Log In (Text Button) */}
            <button
              onClick={() => {
                setAuthMode('signin');
                setAuthModalOpen(true);
              }}
              className="text-sm font-medium text-[#475569] hover:text-[#0F172A] px-3 py-2 transition-colors duration-150"
            >
              Log in
            </button>

            {/* Get Started (Solid Accent Button) */}
            <button
              onClick={() => {
                setAuthMode('signup');
                setAuthModalOpen(true);
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors duration-150 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
            >
              Get started
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -mr-2 rounded-lg text-[#475569] hover:text-[#0F172A] md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-In Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-[#0F172A]/[0.08] bg-white px-6 py-4 shadow-lg"
            >
              <nav className="flex flex-col space-y-3 pb-3 text-sm font-medium text-[#475569]">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1.5 hover:text-[#0F172A]"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1.5 hover:text-[#0F172A]"
                >
                  How it works
                </a>
                <a
                  href="#dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1.5 hover:text-[#0F172A]"
                >
                  Dashboard
                </a>
                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1.5 hover:text-[#0F172A]"
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1.5 hover:text-[#0F172A]"
                >
                  FAQ
                </a>
              </nav>

              <div className="pt-3 border-t border-[#0F172A]/[0.08] flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleDemoLogin();
                  }}
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 text-center"
                >
                  Explore live demo
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-full text-sm font-medium text-white bg-[#2F5BFF] text-center"
                >
                  Get started free
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── 2. HERO SECTION (12-Column Grid) ────────────────────────── */}
      <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 overflow-hidden bg-[#FFFFFF]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Headline & Value Proposition (7 Cols) */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F7F8FA] border border-[#0F172A]/[0.08] text-xs font-medium text-[#475569]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                <span>AI Vision 2.0 • Indian & International Portions</span>
              </div>

              {/* H1 Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] lg:leading-[60px] font-bold font-display tracking-[-0.02em] text-[#0F172A]">
                Log every meal with a single photo.
              </h1>

              {/* Subheadline (Restrained & Specific) */}
              <p className="text-base sm:text-lg leading-[26px] text-[#475569] max-w-[60ch]">
                Fitsnap recognizes your food, estimates portions, and calculates calories and macros automatically, including rotis, dals, katoris, and everyday home-cooked meals.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-base font-medium text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors duration-150 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(47,91,255,0.25)]"
                >
                  <span>Get started free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-full text-base font-medium text-[#0F172A] bg-transparent border border-[#0F172A]/[0.15] hover:bg-[#F7F8FA] transition-colors duration-150"
                >
                  See how it works
                </a>
              </div>

              {/* Microcopy */}
              <p className="text-[13px] leading-[18px] text-[#94A3B8]">
                Free plan available. No credit card required.
              </p>

              {/* Small Trust Row */}
              <div className="pt-4 border-t border-[#0F172A]/[0.08] flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex text-[#F59E0B]" aria-label="5 star rating">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A]">4.9 / 5</span>
                  <span className="text-xs text-[#94A3B8]">• [PLACEHOLDER] 2,400+ reviews</span>
                </div>

                <div className="h-4 w-px bg-[#0F172A]/[0.1] hidden sm:block" />

                <div className="text-xs text-[#475569] font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A]" strokeWidth={1.5} />
                  <span>Clinically verified portion density [PLACEHOLDER]</span>
                </div>
              </div>

            </div>

            {/* Right Column: Realistic iPhone Product Mockup (5 Cols, Fully Contained) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[340px] sm:max-w-[360px] relative">
                
                {/* Subtle soft backdrop shadow */}
                <div className="absolute inset-0 bg-[#2F5BFF]/10 rounded-[48px] blur-2xl transform scale-95 translate-y-4 -z-10" />

                {/* iPhone Frame */}
                <div className="rounded-[44px] border-[9px] border-[#0F172A] bg-[#FFFFFF] shadow-[0_20px_48px_-12px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.08)] overflow-hidden">
                  
                  {/* Dynamic Island / Top Notch */}
                  <div className="pt-2 pb-1 bg-[#FFFFFF] flex justify-center">
                    <div className="w-24 h-5 rounded-full bg-[#0F172A] flex items-center justify-end px-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1E293B]" />
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div className="px-6 py-1 flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#475569]">
                      <span>5G</span>
                      <div className="w-4 h-2 rounded-[2px] border border-[#0F172A] p-0.5 flex items-center">
                        <div className="w-full h-full bg-[#0F172A] rounded-[1px]" />
                      </div>
                    </div>
                  </div>

                  {/* App Screen Content: Realistic Food Scan */}
                  <div className="p-4 space-y-3.5 bg-[#F7F8FA]">
                    
                    {/* App Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                        <span className="text-xs font-semibold text-[#0F172A]">Live Vision Scan</span>
                      </div>
                      <span className="text-[11px] font-medium text-[#475569] bg-white px-2 py-0.5 rounded-md border border-[#0F172A]/[0.08]">
                        Lunch • 1:15 PM
                      </span>
                    </div>

                    {/* Meal Photo with AI Bounding Box */}
                    <div className="relative rounded-xl overflow-hidden border border-[#0F172A]/[0.08] bg-white">
                      
                      {/* Realistic Dish Photo (Indian Meal with Roti & Curry) */}
                      <img
                        src="https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=700&q=80"
                        alt="Indian meal plate with paneer and rotis"
                        onError={(e) => {
                          e.currentTarget.src = '/textures/food_bowl_round.png';
                        }}
                        className="w-full h-44 object-cover"
                        loading="lazy"
                      />

                      {/* Vision Scan Reticle / Bounding Box */}
                      <div className="absolute inset-3 border border-[#2F5BFF] rounded-lg pointer-events-none">
                        {/* Corner Reticle Accents */}
                        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#2F5BFF]" />
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#2F5BFF]" />
                        <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#2F5BFF]" />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#2F5BFF]" />

                        {/* Subtle Horizontal Scanning Beam */}
                        <div className="absolute left-0 right-0 h-[1.5px] bg-[#2F5BFF] opacity-75 animate-scan" />
                      </div>

                      {/* Detected Food Chip Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-[#0F172A]/90 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-lg text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] flex-shrink-0" />
                          <span className="font-medium truncate">Paneer Tikka & 2 Rotis</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#93B5FD] flex-shrink-0">98% match</span>
                      </div>
                    </div>

                    {/* Detected Items & Portions Card */}
                    <div className="bg-[#FFFFFF] rounded-xl p-3 border border-[#0F172A]/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.06)] space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#0F172A]/[0.06]">
                        <span className="font-semibold text-[#0F172A]">Detected Ingredients</span>
                        <span className="text-[11px] text-[#475569]">Calibrated Portions</span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#0F172A] font-medium">Whole Wheat Roti</span>
                          <span className="text-[#475569] font-mono text-[11px]">2 pcs (160 kcal)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#0F172A] font-medium">Paneer Masala</span>
                          <span className="text-[#475569] font-mono text-[11px]">1 katori (280 kcal)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#0F172A] font-medium">Cucumber Salad</span>
                          <span className="text-[#475569] font-mono text-[11px]">0.5 cup (25 kcal)</span>
                        </div>
                      </div>
                    </div>

                    {/* Calorie & Macro Breakdown Pill Strip */}
                    <div className="bg-[#FFFFFF] rounded-xl p-3 border border-[#0F172A]/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs font-semibold text-[#0F172A]">Meal Total</span>
                        <div className="text-right">
                          <span className="text-base font-bold text-[#0F172A]">465</span>
                          <span className="text-xs text-[#94A3B8] ml-1">kcal</span>
                        </div>
                      </div>

                      {/* 3 Macro Bars */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#F7F8FA] rounded-lg py-1.5 px-1 border border-[#0F172A]/[0.04]">
                          <span className="text-[10px] font-semibold text-[#475569] block">PROTEIN</span>
                          <span className="text-xs font-bold text-[#0F172A]">22.4g</span>
                        </div>
                        <div className="bg-[#F7F8FA] rounded-lg py-1.5 px-1 border border-[#0F172A]/[0.04]">
                          <span className="text-[10px] font-semibold text-[#475569] block">CARBS</span>
                          <span className="text-xs font-bold text-[#0F172A]">51.0g</span>
                        </div>
                        <div className="bg-[#F7F8FA] rounded-lg py-1.5 px-1 border border-[#0F172A]/[0.04]">
                          <span className="text-[10px] font-semibold text-[#475569] block">FAT</span>
                          <span className="text-xs font-bold text-[#0F172A]">18.2g</span>
                        </div>
                      </div>
                    </div>

                    {/* Instant Log Action Button */}
                    <button
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthModalOpen(true);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Log to Diary • 465 kcal</span>
                    </button>

                  </div>

                  {/* Home Bar Indicator */}
                  <div className="py-2 bg-white flex justify-center">
                    <div className="w-32 h-1 bg-[#0F172A]/20 rounded-full" />
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. LOGO / TRUST STRIP (Grayscale, Restrained) ───────────── */}
      <section className="py-10 bg-[#F7F8FA] border-y border-[#0F172A]/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-center text-xs font-semibold tracking-wider text-[#94A3B8] uppercase mb-6">
            RECOGNIZED BY LEADING HEALTH &amp; TECHNOLOGY EDITORS [PLACEHOLDER]
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 items-center justify-items-center opacity-70">
            {/* Minimalist Grayscale Partner / Press Placeholders */}
            <div className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[#475569]">
              <span className="text-base font-bold text-[#0F172A]">TC</span> [PLACEHOLDER] TechCrunch
            </div>
            <div className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[#475569]">
              <span className="text-base font-bold text-[#0F172A]">MH</span> [PLACEHOLDER] Men's Health
            </div>
            <div className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[#475569]">
              <span className="text-base font-bold text-[#0F172A]">FH</span> [PLACEHOLDER] Forbes Health
            </div>
            <div className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[#475569]">
              <span className="text-base font-bold text-[#0F172A]">WIRED</span> [PLACEHOLDER]
            </div>
            <div className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[#475569] col-span-2 sm:col-span-1">
              <span className="text-base font-bold text-[#0F172A]">PH</span> [PLACEHOLDER] Product Hunt #1
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES SECTION (3 Cards with Lucide line icons) ────── */}
      <section id="features" className="py-20 lg:py-28 bg-[#FFFFFF]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-wider text-[#2F5BFF] uppercase">
              Core Capabilities
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0F172A]">
              Nutrition tracking that fits into your day.
            </h2>
            <p className="mt-3 text-base text-[#475569]">
              Built with computer vision calibrated for real-world cooking—not just pre-packaged supermarket barcodes.
            </p>
          </div>

          {/* 3 Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1: Instant Meal Recognition */}
            <div className="bg-[#FFFFFF] rounded-card border border-[#0F172A]/[0.08] shadow-subtle hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center mb-5">
                  <Scan className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-[20px] leading-[28px] font-semibold text-[#0F172A] mb-2 font-display">
                  Instant meal recognition
                </h3>
                <p className="text-sm leading-relaxed text-[#475569] mb-6">
                  Snap any plate—from home-cooked thalis to restaurant meals. AI vision detects dishes and logs portion sizes in seconds.
                </p>
              </div>

              {/* Small Realistic UI Snippet */}
              <div className="bg-[#F7F8FA] rounded-lg p-3 border border-[#0F172A]/[0.06] text-xs space-y-2">
                <div className="flex items-center justify-between text-[#0F172A] font-medium">
                  <span>Dal Makhani + Jeera Rice</span>
                  <span className="text-[#16A34A] font-semibold">97% match</span>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded bg-white border border-[#0F172A]/[0.08] text-[11px] text-[#475569]">
                    1 katori Dal (210 kcal)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-[#0F172A]/[0.08] text-[11px] text-[#475569]">
                    1 cup Rice (240 kcal)
                  </span>
                </div>
              </div>
            </div>

            {/* Feature 2: Clear Progress Tracking */}
            <div className="bg-[#FFFFFF] rounded-card border border-[#0F172A]/[0.08] shadow-subtle hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center mb-5">
                  <Activity className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-[20px] leading-[28px] font-semibold text-[#0F172A] mb-2 font-display">
                  Clear progress tracking
                </h3>
                <p className="text-sm leading-relaxed text-[#475569] mb-6">
                  Visual macro rings and weekly trend charts transform confusing nutritional data into clear, actionable daily goals.
                </p>
              </div>

              {/* Small Realistic UI Snippet */}
              <div className="bg-[#F7F8FA] rounded-lg p-3 border border-[#0F172A]/[0.06] text-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-[#0F172A]">Daily Protein Target</span>
                  <span className="font-bold text-[#2F5BFF]">132g / 140g</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#2F5BFF] h-full rounded-full" style={{ width: '94%' }} />
                </div>
                <div className="mt-2 text-[11px] text-[#475569] flex justify-between">
                  <span>94% completed</span>
                  <span>8g remaining</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Personalized Daily Guidance */}
            <div className="bg-[#FFFFFF] rounded-card border border-[#0F172A]/[0.08] shadow-subtle hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center mb-5">
                  <Compass className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-[20px] leading-[28px] font-semibold text-[#0F172A] mb-2 font-display">
                  Personalized daily guidance
                </h3>
                <p className="text-sm leading-relaxed text-[#475569] mb-6">
                  Receive contextual adjustments based on your logged meals, workout energy expenditure, and remaining macros.
                </p>
              </div>

              {/* Small Realistic UI Snippet */}
              <div className="bg-[#F7F8FA] rounded-lg p-3 border border-[#0F172A]/[0.06] text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
                  <Sparkles className="w-3.5 h-3.5 text-[#2F5BFF]" />
                  <span>Coach Insight</span>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  "Leg workout logged (-380 kcal). Add 24g protein at dinner to optimize recovery and hit your daily goal."
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS (3 Numbered Steps Alternating Layout) ──── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-[#F7F8FA] border-t border-[#0F172A]/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-xs font-semibold tracking-wider text-[#2F5BFF] uppercase">
              Three-Step Workflow
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0F172A]">
              How Fitsnap works
            </h2>
            <p className="mt-3 text-base text-[#475569]">
              Designed to eliminate the friction that causes 80% of people to abandon nutrition tracking within two weeks.
            </p>
          </div>

          <div className="space-y-20 lg:space-y-24">
            
            {/* Step 1: Snap (Text Left, Visual Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs font-bold tracking-widest text-[#2F5BFF] uppercase font-mono">
                  STEP 01
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0F172A]">
                  Snap your plate from any angle.
                </h3>
                <p className="text-base leading-relaxed text-[#475569] max-w-[50ch]">
                  Point your camera at your meal. No kitchen scales, measuring spoons, or endless scrolling through inaccurate user-submitted databases required.
                </p>
                <ul className="pt-2 space-y-2 text-sm text-[#475569]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Works in natural lighting, restaurant dining, or low ambient light.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Recognizes layered dishes (dals, curries, thalis, and mixed bowls).</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-6">
                <div className="bg-white rounded-card border border-[#0F172A]/[0.08] shadow-subtle p-6 max-w-md mx-auto">
                  <div className="aspect-[4/3] rounded-lg bg-[#F7F8FA] border border-[#0F172A]/[0.06] overflow-hidden relative flex items-center justify-center">
                    <img
                      src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80"
                      alt="Salad plate viewfinder"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-4 border border-dashed border-white/80 rounded-md pointer-events-none flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 bg-[#0F172A]/80 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-mono text-white">
                      AUTOFOCUS: LOCKED
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-[#475569]">
                    <span>Camera input: High-res multi-spectrum</span>
                    <span className="font-semibold text-[#16A34A]">Ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Analyze (Visual Left, Text Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1">
                <div className="bg-white rounded-card border border-[#0F172A]/[0.08] shadow-subtle p-6 max-w-md mx-auto space-y-4">
                  <div className="flex items-center justify-between border-b border-[#0F172A]/[0.06] pb-3">
                    <span className="text-xs font-semibold text-[#0F172A]">AI Volumetric Segmentation</span>
                    <span className="text-[11px] font-mono text-[#2F5BFF]">Calculated in 1.2s</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F8FA] border border-[#0F172A]/[0.06]">
                      <div>
                        <span className="text-xs font-semibold text-[#0F172A] block">Palak Paneer</span>
                        <span className="text-[11px] text-[#475569]">Estimated: 1 standard katori (~180g)</span>
                      </div>
                      <span className="text-xs font-bold text-[#0F172A]">220 kcal</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F8FA] border border-[#0F172A]/[0.06]">
                      <div>
                        <span className="text-xs font-semibold text-[#0F172A] block">Tawa Roti</span>
                        <span className="text-[11px] text-[#475569]">Estimated: 2 medium phulkas (~60g)</span>
                      </div>
                      <span className="text-xs font-bold text-[#0F172A]">160 kcal</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#0F172A]/[0.06] flex items-center justify-between text-xs">
                    <span className="text-[#475569]">Calculated Confidence</span>
                    <span className="font-semibold text-[#16A34A]">98.2% calibrated</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4 order-1 lg:order-2">
                <span className="text-xs font-bold tracking-widest text-[#2F5BFF] uppercase font-mono">
                  STEP 02
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0F172A]">
                  AI vision segments and estimates volume.
                </h3>
                <p className="text-base leading-relaxed text-[#475569] max-w-[50ch]">
                  Fitsnap uses calibrated volumetric algorithms that accurately differentiate between 1 vs 2 rotis, katoris of dal, or cups of rice.
                </p>
                <ul className="pt-2 space-y-2 text-sm text-[#475569]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Trained specifically on Indian serving units (katoris, rotis, spoons).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Every ingredient and portion size remains 100% editable with a tap.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 3: Improve (Text Left, Visual Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs font-bold tracking-widest text-[#2F5BFF] uppercase font-mono">
                  STEP 03
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0F172A]">
                  Build sustainable nutritional habits.
                </h3>
                <p className="text-base leading-relaxed text-[#475569] max-w-[50ch]">
                  Review your progress with visual macro rings and trend forecasts. Receive proactive recommendations to reach your body composition goals.
                </p>
                <ul className="pt-2 space-y-2 text-sm text-[#475569]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Daily guidance tells you what to eat next, not just what went wrong.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Syncs with workouts and hydration for complete energy balance.</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-6">
                <div className="bg-white rounded-card border border-[#0F172A]/[0.08] shadow-subtle p-6 max-w-md mx-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#0F172A] block">Weekly Consistency</span>
                      <span className="text-[11px] text-[#475569]">Target: 2,100 kcal / day</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] text-xs font-bold">
                      94% Adherence
                    </span>
                  </div>

                  {/* 7-day mini bar adherence */}
                  <div className="grid grid-cols-7 gap-2 items-end h-20 pt-2 border-b border-[#0F172A]/[0.06]">
                    {[
                      { day: 'M', h: '88%' },
                      { day: 'T', h: '95%' },
                      { day: 'W', h: '92%' },
                      { day: 'T', h: '98%' },
                      { day: 'F', h: '94%' },
                      { day: 'S', h: '90%' },
                      { day: 'S', h: '96%' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <div
                          className="w-full bg-[#2F5BFF] rounded-t-sm transition-all"
                          style={{ height: item.h }}
                        />
                        <span className="text-[10px] text-[#94A3B8] font-mono">{item.day}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed">
                    "Consistent protein intake maintained for 6 consecutive days. Average deficit: 320 kcal/day."
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 6. DASHBOARD PREVIEW (Dark Section #0B0D12 - Max One Allowed) */}
      <section id="dashboard" className="py-20 lg:py-28 bg-[#0B0D12] text-white">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-wider text-[#93B5FD] uppercase font-mono">
              Nutritional Command Center
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold font-display tracking-tight text-white">
              A dashboard built for clarity, not clutter.
            </h2>
            <p className="mt-3 text-base text-[#94A3B8]">
              Clean 2D biometrics and crisp progress charts that make your nutritional status immediately obvious.
            </p>
          </div>

          {/* Crisp High-Contrast Dashboard Mockup */}
          <div className="rounded-2xl border border-white/10 bg-[#12151D] shadow-[0_24px_48px_rgba(0,0,0,0.6)] overflow-hidden p-6 sm:p-8">
            
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono text-[#94A3B8]">TODAY'S SUMMARY • OCTOBER 24</span>
                <h3 className="text-xl font-bold text-white font-display">Nutrition &amp; Energy Balance</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#94A3B8] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>14-day streak [PLACEHOLDER]</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#16A34A]/10 border border-[#16A34A]/20 text-xs text-[#4ADE80] font-semibold">
                  On track (+340 kcal left)
                </div>
              </div>
            </div>

            {/* Dashboard 3-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
              
              {/* Macro Rings Overview (5 Cols) */}
              <div className="lg:col-span-5 bg-white/[0.03] rounded-xl border border-white/10 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Macro Targets</span>
                  <span className="text-xs text-[#94A3B8]">1,860 / 2,200 kcal</span>
                </div>

                {/* 3 Crisp Concentric 2D SVG Rings */}
                <div className="flex items-center justify-center py-2">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                      {/* Protein Ring (Outer - #2F5BFF) */}
                      <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="transparent" />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#2F5BFF"
                        strokeWidth="10"
                        strokeDasharray={440}
                        strokeDashoffset={440 * (1 - 0.94)}
                        strokeLinecap="round"
                        fill="transparent"
                      />

                      {/* Carbs Ring (Middle - #10B981) */}
                      <circle cx="80" cy="80" r="54" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="transparent" />
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        stroke="#10B981"
                        strokeWidth="10"
                        strokeDasharray={340}
                        strokeDashoffset={340 * (1 - 0.88)}
                        strokeLinecap="round"
                        fill="transparent"
                      />

                      {/* Fat Ring (Inner - #F59E0B) */}
                      <circle cx="80" cy="80" r="38" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="transparent" />
                      <circle
                        cx="80"
                        cy="80"
                        r="38"
                        stroke="#F59E0B"
                        strokeWidth="10"
                        strokeDasharray={240}
                        strokeDashoffset={240 * (1 - 0.78)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>

                    {/* Center Calorie Label */}
                    <div className="absolute text-center">
                      <span className="text-2xl font-bold font-display text-white block">1,860</span>
                      <span className="text-[11px] text-[#94A3B8]">kcal logged</span>
                    </div>
                  </div>
                </div>

                {/* Macro Legend */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-[#2F5BFF]" />
                      <span className="text-[11px] text-[#94A3B8]">Protein</span>
                    </div>
                    <span className="text-sm font-bold text-white">132g / 140g</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                      <span className="text-[11px] text-[#94A3B8]">Carbs</span>
                    </div>
                    <span className="text-sm font-bold text-white">198g / 225g</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                      <span className="text-[11px] text-[#94A3B8]">Fat</span>
                    </div>
                    <span className="text-sm font-bold text-white">51g / 65g</span>
                  </div>
                </div>
              </div>

              {/* Water Intake & Weekly Chart (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Hydration Tracker */}
                <div className="bg-white/[0.03] rounded-xl border border-white/10 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-[#38BDF8]" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">Hydration</span>
                    </div>
                    <span className="text-xs font-mono text-[#38BDF8] font-bold">2,250 / 2,500 ml (90%)</span>
                  </div>
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#38BDF8] h-full rounded-full transition-all" style={{ width: '90%' }} />
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-[#94A3B8]">
                    <span>Last logged: 45m ago (+250ml)</span>
                    <span className="text-white font-medium">1 glass remaining</span>
                  </div>
                </div>

                {/* 7-Day Adherence Chart */}
                <div className="bg-white/[0.03] rounded-xl border border-white/10 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">7-Day Calorie Adherence</span>
                    <span className="text-[11px] text-[#94A3B8]">Goal: 2,200 kcal</span>
                  </div>

                  {/* SVG Crisp Adherence Bar Chart */}
                  <div className="h-32 flex items-end justify-between gap-3 pt-4">
                    {[
                      { day: 'Mon', val: 2150, pct: 97 },
                      { day: 'Tue', val: 2210, pct: 100 },
                      { day: 'Wed', val: 2180, pct: 99 },
                      { day: 'Thu', val: 2240, pct: 101 },
                      { day: 'Fri', val: 2190, pct: 99 },
                      { day: 'Sat', val: 2120, pct: 96 },
                      { day: 'Sun', val: 1860, pct: 85 },
                    ].map((bar, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <div
                          className="w-full bg-[#2F5BFF] group-hover:bg-[#608EFB] rounded-t-sm transition-all"
                          style={{ height: `${(bar.val / 2400) * 100}%` }}
                        />
                        <span className="text-[11px] font-mono text-[#94A3B8]">{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── 7. TESTIMONIALS (3 Realistic Cards) ─────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#FFFFFF]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-wider text-[#2F5BFF] uppercase">
              Member Experiences
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0F172A]">
              Tested by disciplined athletes and busy professionals.
            </h2>
            <p className="mt-3 text-base text-[#475569]">
              Real feedback on how photo-based logging removes daily nutritional friction.
            </p>
          </div>

          {/* 3 Realistic Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Testimonial 1 */}
            <div className="bg-[#FFFFFF] rounded-card border border-[#0F172A]/[0.08] shadow-subtle hover:shadow-lifted transition-all duration-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex text-[#F59E0B] mb-4" aria-label="5 stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-[#0F172A] mb-6">
                  "Fitsnap is the first tracker that correctly understands dal and homemade rotis without me guessing tablespoons of oil. It cut my daily logging time from 15 minutes to under 30 seconds."
                </p>
              </div>

              <div className="pt-4 border-t border-[#0F172A]/[0.08] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F7F8FA] border border-[#0F172A]/[0.08] flex items-center justify-center font-bold text-xs text-[#475569]">
                  AS
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#0F172A]">
                    Aarav Sharma <span className="text-[11px] font-normal text-[#94A3B8]">[PLACEHOLDER]</span>
                  </h4>
                  <p className="text-xs text-[#475569]">Bengaluru • Software Engineer</p>
                  <span className="text-[11px] font-medium text-[#2F5BFF]">Goal: Hypertrophy &amp; Lean Bulk</span>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-[#FFFFFF] rounded-card border border-[#0F172A]/[0.08] shadow-subtle hover:shadow-lifted transition-all duration-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex text-[#F59E0B] mb-4" aria-label="5 stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-[#0F172A] mb-6">
                  "The portion estimation is astonishingly accurate compared to my kitchen scale. It has completely eliminated the friction of tracking nutrition during heavy training weeks."
                </p>
              </div>

              <div className="pt-4 border-t border-[#0F172A]/[0.08] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F7F8FA] border border-[#0F172A]/[0.08] flex items-center justify-center font-bold text-xs text-[#475569]">
                  PP
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#0F172A]">
                    Priya Patel <span className="text-[11px] font-normal text-[#94A3B8]">[PLACEHOLDER]</span>
                  </h4>
                  <p className="text-xs text-[#475569]">London • Management Consultant</p>
                  <span className="text-[11px] font-medium text-[#2F5BFF]">Goal: Marathon Prep &amp; Fat Loss</span>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-[#FFFFFF] rounded-card border border-[#0F172A]/[0.08] shadow-subtle hover:shadow-lifted transition-all duration-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex text-[#F59E0B] mb-4" aria-label="5 stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-[#0F172A] mb-6">
                  "Clean, restrained design with zero bloated gimmicks. The daily macro guidance gives me clear next steps instead of just throwing charts at me."
                </p>
              </div>

              <div className="pt-4 border-t border-[#0F172A]/[0.08] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F7F8FA] border border-[#0F172A]/[0.08] flex items-center justify-center font-bold text-xs text-[#475569]">
                  MV
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#0F172A]">
                    Marcus Vance <span className="text-[11px] font-normal text-[#94A3B8]">[PLACEHOLDER]</span>
                  </h4>
                  <p className="text-xs text-[#475569]">Austin, TX • Endurance Coach</p>
                  <span className="text-[11px] font-medium text-[#2F5BFF]">Goal: Metabolic Health &amp; Energy</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8. PRICING (Free vs Pro with Toggle) ────────────────────── */}
      <section id="pricing" className="py-20 lg:py-28 bg-[#F7F8FA] border-t border-[#0F172A]/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold tracking-wider text-[#2F5BFF] uppercase">
              Transparent Pricing
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0F172A]">
              Simple plans for sustainable habits.
            </h2>
            <p className="mt-3 text-base text-[#475569]">
              Start with our free plan. Upgrade to Pro when you want unlimited scans and personalized AI coaching.
            </p>

            {/* Monthly / Yearly Billing Toggle */}
            <div className="mt-8 inline-flex items-center p-1 rounded-full bg-white border border-[#0F172A]/[0.08] shadow-subtle">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                Monthly billing
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <span>Annual billing</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#16A34A]/15 text-[#16A34A] text-[10px] font-bold">
                  Save 38%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            
            {/* Free Tier */}
            <div className="bg-white rounded-card border border-[#0F172A]/[0.08] shadow-subtle p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] block mb-2 font-mono">
                  FREE PLAN
                </span>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-[#0F172A] font-display">$0</span>
                  <span className="text-sm text-[#94A3B8]">/ forever</span>
                </div>
                <p className="text-sm text-[#475569] mb-6">
                  Core photo logging and fundamental nutrition metrics for everyday health.
                </p>

                <div className="space-y-3 pt-6 border-t border-[#0F172A]/[0.08] text-sm text-[#0F172A]">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Daily food photo logging (up to 3 meals/day)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Standard Indian &amp; Western portion estimations</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Core macro tracking (Calories, Protein, Carbs, Fat)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Hydration tracking &amp; 7-day log history</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-3 rounded-full text-sm font-medium text-[#0F172A] bg-transparent border border-[#0F172A]/[0.15] hover:bg-[#F7F8FA] transition-colors"
                >
                  Get started free
                </button>
              </div>
            </div>

            {/* Pro Tier (Highlighted Card) */}
            <div className="bg-white rounded-card border-2 border-[#2F5BFF] shadow-lifted p-8 relative flex flex-col justify-between">
              
              {/* Popular Pill Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#2F5BFF] text-white text-[11px] font-bold tracking-wide uppercase">
                Most Popular
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#2F5BFF] block mb-2 font-mono">
                  FITSNAP PRO
                </span>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-[#0F172A] font-display">
                    {billingCycle === 'yearly' ? '$4' : '$5'}
                  </span>
                  <span className="text-sm text-[#94A3B8]">
                    / month {billingCycle === 'yearly' && '(billed annually at $48/yr)'}
                  </span>
                </div>
                <p className="text-sm text-[#475569] mb-6">
                  For athletes and nutrition enthusiasts demanding high precision and custom coaching.
                </p>

                <div className="space-y-3 pt-6 border-t border-[#0F172A]/[0.08] text-sm text-[#0F172A]">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span className="font-semibold">Unlimited high-resolution AI vision scans</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Personalized daily AI coaching recommendations</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Custom macro targets by workout training schedule</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Micronutrient breakdowns (fiber, sodium, saturated fat)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
                    <span>Full historical analytics &amp; CSV health export</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-3 rounded-full text-sm font-medium text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle"
                >
                  Start 14-day free trial
                </button>
                <p className="text-center text-[11px] text-[#94A3B8] mt-2">
                  Cancel anytime with 1 click. No surprise fees.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 9. FAQ ACCORDION (Accessible, Keyboard-Navigable) ──────── */}
      <section id="faq" className="py-20 lg:py-28 bg-[#FFFFFF]">
        <div className="max-w-[800px] mx-auto px-6">
          
          {/* Header */}
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-wider text-[#2F5BFF] uppercase">
              Frequently Asked Questions
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0F172A]">
              Clear answers to common questions.
            </h2>
          </div>

          {/* Accordion Container */}
          <div className="space-y-4">
            {[
              {
                q: 'How accurate is the AI portion estimation?',
                a: 'Fitsnap combines calibrated computer vision models with standard density tables for home-cooked meals and regional cuisines. In benchmark testing, estimates fall within ±8-12% of kitchen scale weights. You can adjust grams, katoris, or pieces with a single tap before saving.',
              },
              {
                q: 'How does Fitsnap protect my health and personal data?',
                a: 'Your health logs and uploaded meal photos are encrypted in transit and at rest. We never sell your personal data or photos to third-party advertisers. Photos are processed strictly to calculate nutritional values and can be permanently removed anytime.',
              },
              {
                q: 'Does Fitsnap recognize regional home-cooked Indian dishes?',
                a: 'Yes. Fitsnap was purpose-trained on Indian home cooking—including rotis, phulkas, dal tadka, paneer butter masala, idlis, dosas, sambar, khichdi, and sabzis—with native serving sizes like katoris, rotis, and pieces.',
              },
              {
                q: 'Can I cancel or switch plans at any time?',
                a: 'Yes. You can manage or cancel your subscription at any time directly in your account settings with a single click. When you cancel, your Pro features remain active until the end of your current billing period.',
              },
            ].map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-card border border-[#0F172A]/[0.08] bg-[#FFFFFF] overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    className="w-full text-left px-6 py-4 flex items-center justify-between text-base font-semibold text-[#0F172A] hover:bg-[#F7F8FA] transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#475569] transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${index}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-6 pb-4 pt-1 text-sm leading-relaxed text-[#475569] border-t border-[#0F172A]/[0.06]">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── 10. FINAL CTA BAND (Solid Accent Color - NOT Gradient!) ── */}
      <section className="py-20 bg-[#2F5BFF] text-white">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold font-display tracking-tight text-white leading-tight">
              Start tracking smarter today.
            </h2>
            <p className="text-base sm:text-lg text-white/90 leading-relaxed max-w-[50ch] mx-auto">
              Join thousands who have simplified their daily food tracking. Instant photo logs, zero friction, and clear progress.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setAuthModalOpen(true);
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full text-base font-semibold text-[#2F5BFF] bg-white hover:bg-[#EFF4FF] transition-colors shadow-subtle"
              >
                Get started free
              </button>

              <button
                onClick={handleDemoLogin}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full text-base font-medium text-white bg-transparent border border-white/30 hover:bg-white/10 transition-colors"
              >
                Try the live demo
              </button>
            </div>

            <p className="text-xs text-white/80 font-medium">
              Free plan available • No credit card required • Instant setup
            </p>
          </div>
        </div>
      </section>

      {/* ── 10B. FOOTER (4 Link Columns + Required Medical Disclaimer) */}
      <footer className="bg-[#FFFFFF] border-t border-[#0F172A]/[0.08] py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-[#0F172A]/[0.08]">
            
            {/* Col 1: Brand Info */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[7px] bg-[#2F5BFF] flex items-center justify-center text-white">
                  <Scan className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <span className="text-lg font-bold font-display text-[#0F172A]">
                  Fitsnap<span className="text-[#2F5BFF]">.</span>
                </span>
              </div>
              <p className="text-sm text-[#475569] max-w-sm leading-relaxed">
                Precision nutrition tracking powered by AI computer vision. Calibrated for Indian and international dining.
              </p>
              <div className="pt-1 flex items-center gap-4 text-[#94A3B8]">
                <a href="#" className="hover:text-[#0F172A] transition-colors" aria-label="Fitsnap on Twitter">
                  <span className="text-xs font-semibold">Twitter</span>
                </a>
                <a href="#" className="hover:text-[#0F172A] transition-colors" aria-label="Fitsnap on GitHub">
                  <span className="text-xs font-semibold">GitHub</span>
                </a>
                <a href="#" className="hover:text-[#0F172A] transition-colors" aria-label="Fitsnap on LinkedIn">
                  <span className="text-xs font-semibold">LinkedIn</span>
                </a>
              </div>
            </div>

            {/* Col 2: Product */}
            <div className="space-y-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0F172A] block font-mono">
                Product
              </span>
              <ul className="space-y-2 text-[#475569]">
                <li><a href="#features" className="hover:text-[#0F172A] transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-[#0F172A] transition-colors">How it works</a></li>
                <li><a href="#dashboard" className="hover:text-[#0F172A] transition-colors">Dashboard</a></li>
                <li><a href="#pricing" className="hover:text-[#0F172A] transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">PWA Mobile App [PLACEHOLDER]</a></li>
              </ul>
            </div>

            {/* Col 3: Cuisines */}
            <div className="space-y-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0F172A] block font-mono">
                Cuisines
              </span>
              <ul className="space-y-2 text-[#475569]">
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Indian Food Database</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Roti &amp; Katori Calibration</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Western Classics</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Macro Library</a></li>
              </ul>
            </div>

            {/* Col 4: Legal & Trust */}
            <div className="space-y-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0F172A] block font-mono">
                Company &amp; Legal
              </span>
              <ul className="space-y-2 text-[#475569]">
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Security Overview</a></li>
                <li><a href="#" className="hover:text-[#0F172A] transition-colors">Contact Support</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar: Copyright & Medical Disclaimer */}
          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#94A3B8]">
            <p>© 2026 Fitsnap Inc. All rights reserved.</p>

            {/* REQUIRED MEDICAL DISCLAIMER */}
            <p className="max-w-xl text-[12px] leading-relaxed text-[#94A3B8] sm:text-right">
              <span className="font-semibold text-[#475569]">Medical Disclaimer: </span>
              Fitsnap provides general nutrition information and is not a substitute for professional medical advice.
            </p>
          </div>

        </div>
      </footer>

      {/* ── AUTH MODAL (Sign In / Sign Up Dialog) ───────────────────── */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-white rounded-card shadow-[0_20px_48px_rgba(15,23,42,0.18)] border border-[#0F172A]/[0.08] p-6 sm:p-8 z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F7F8FA] transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="mb-5">
                <div className="w-8 h-8 rounded-[8px] bg-[#2F5BFF] flex items-center justify-center text-white mb-3">
                  <Scan className="w-4 h-4" strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold font-display text-[#0F172A]">
                  {authMode === 'signin' && 'Sign in to Fitsnap'}
                  {authMode === 'signup' && 'Create your Fitsnap account'}
                  {authMode === 'forgot' && 'Reset your password'}
                </h3>
                <p className="text-xs text-[#475569] mt-1">
                  {authMode === 'signin' && 'Enter your credentials to access your nutrition dashboard.'}
                  {authMode === 'signup' && 'Start logging your meals with AI vision in seconds.'}
                  {authMode === 'forgot' && 'Enter your email address and we will send password reset instructions.'}
                </p>
              </div>

              {/* Mode Switch Tabs (only for signin/signup) */}
              {authMode !== 'forgot' && (
                <div className="grid grid-cols-2 p-1 rounded-lg bg-[#F7F8FA] border border-[#0F172A]/[0.06] mb-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setServerError('');
                      setServerErrorCode('');
                      setEmailError('');
                      setPasswordError('');
                    }}
                    className={`py-2 rounded-md transition-all ${
                      authMode === 'signin'
                        ? 'bg-white text-[#0F172A] shadow-subtle'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setServerError('');
                      setServerErrorCode('');
                      setEmailError('');
                      setPasswordError('');
                    }}
                    className={`py-2 rounded-md transition-all ${
                      authMode === 'signup'
                        ? 'bg-white text-[#0F172A] shadow-subtle'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Create account
                  </button>
                </div>
              )}

              {/* Instant 1-Click Demo Button */}
              {authMode !== 'forgot' && (
                <>
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={isLoading}
                    className="w-full mb-3 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/15 border border-[#2F5BFF]/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Instant 1-Click Demo Login (demo@fitsnap.app)</span>
                  </button>

                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-[#0F172A]/[0.08]" />
                    <span className="text-[10px] font-mono uppercase text-[#94A3B8]">or continue with email</span>
                    <div className="flex-1 h-px bg-[#0F172A]/[0.08]" />
                  </div>
                </>
              )}

              {/* SPECIFIC ACTIONABLE ERROR BANNERS (Never leave user stuck) */}
              {(serverErrorCode === 'EMAIL_EXISTS' || serverError.toLowerCase().includes('already exists')) && (
                <div className="mb-4 p-3.5 rounded-xl bg-blue-50 border border-[#2F5BFF]/30 text-xs space-y-2 text-[#0F172A]">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-[#2F5BFF] flex-shrink-0" />
                    <span>An account with this email already exists.</span>
                  </div>
                  <p className="text-[11px] text-[#475569]">
                    You can log in to your existing account or reset your password if you forgot it.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setServerError('');
                        setServerErrorCode('');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors"
                    >
                      Log in instead
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setServerError('');
                        setServerErrorCode('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#2F5BFF] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              )}

              {serverErrorCode === 'USER_NOT_FOUND' && (
                <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-1.5 text-[#0F172A]">
                  <span className="font-semibold block">No account found with this email address.</span>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setServerError('');
                        setServerErrorCode('');
                      }}
                      className="text-xs font-semibold text-[#2F5BFF] underline"
                    >
                      Create an account instead
                    </button>
                  </div>
                </div>
              )}

              {serverErrorCode === 'WRONG_PASSWORD' && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs flex items-center justify-between text-[#DC2626]">
                  <span>Incorrect password. Please try again.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setServerError('');
                      setServerErrorCode('');
                    }}
                    className="text-xs font-semibold text-[#2F5BFF] underline ml-2"
                  >
                    Forgot?
                  </button>
                </div>
              )}

              {/* Generic error banner */}
              {serverError &&
                serverErrorCode !== 'EMAIL_EXISTS' &&
                !serverError.toLowerCase().includes('already exists') &&
                serverErrorCode !== 'USER_NOT_FOUND' &&
                serverErrorCode !== 'WRONG_PASSWORD' && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626]">
                    {serverError}
                  </div>
                )}

              {/* ── FORGOT PASSWORD FLOW ────────────────────────────── */}
              {authMode === 'forgot' ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  {forgotSuccess ? (
                    <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-xs text-[#16A34A] space-y-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Reset Email Sent</span>
                      </div>
                      <p className="text-[11px] text-[#475569]">{forgotSuccess}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signin');
                          setForgotSuccess('');
                        }}
                        className="mt-2 text-xs font-semibold text-[#2F5BFF] underline block"
                      >
                        Return to Sign In
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                          Account Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError('');
                          }}
                          placeholder="you@example.com"
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:border-[#2F5BFF] focus:outline-none focus:ring-1 focus:ring-[#2F5BFF] transition-all bg-white"
                        />
                        {emailError && <span className="text-[11px] text-[#DC2626] mt-1 block">{emailError}</span>}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSubmittingForgot}
                          className="flex-1 py-2.5 rounded-full text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle disabled:opacity-50"
                        >
                          {isSubmittingForgot ? 'Sending...' : 'Send Reset Instructions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('signin');
                            setServerError('');
                            setServerErrorCode('');
                          }}
                          className="px-4 py-2.5 rounded-full text-xs font-medium text-[#475569] hover:bg-[#F7F8FA]"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    </>
                  )}
                </form>
              ) : (
                /* ── SIGNIN / SIGNUP FORM ───────────────────────────── */
                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError('');
                        setServerError('');
                        setServerErrorCode('');
                      }}
                      placeholder="you@example.com"
                      required
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none transition-all bg-white ${
                        emailError || serverErrorCode === 'EMAIL_EXISTS'
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                          : 'border-[#0F172A]/[0.15] focus:border-[#2F5BFF] focus:ring-1 focus:ring-[#2F5BFF]'
                      }`}
                    />
                    {emailError && <span className="text-[11px] text-[#DC2626] mt-1 block">{emailError}</span>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#0F172A]">
                        Password
                      </label>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot');
                            setServerError('');
                            setServerErrorCode('');
                          }}
                          className="text-[11px] text-[#2F5BFF] hover:underline"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError('');
                          setServerError('');
                          setServerErrorCode('');
                        }}
                        placeholder="••••••••"
                        required
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none transition-all bg-white pr-10 ${
                          passwordError
                            ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                            : 'border-[#0F172A]/[0.15] focus:border-[#2F5BFF] focus:ring-1 focus:ring-[#2F5BFF]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordError && <span className="text-[11px] text-[#DC2626] mt-1 block">{passwordError}</span>}
                  </div>

                  {/* Remember Me Checkbox */}
                  {authMode === 'signin' && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-[#0F172A]/[0.2] text-[#2F5BFF] focus:ring-[#2F5BFF]"
                      />
                      <label htmlFor="rememberMe" className="text-xs text-[#475569] cursor-pointer">
                        Remember this device for 30 days
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-full text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                      </span>
                    ) : (
                      <>
                        <span>{authMode === 'signin' ? 'Sign in' : 'Create account'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Footer Notice */}
              <p className="mt-4 text-center text-[11px] text-[#94A3B8]">
                By proceeding, you agree to Fitsnap's{' '}
                <a href="#" className="underline hover:text-[#475569]">Terms</a> and{' '}
                <a href="#" className="underline hover:text-[#475569]">Privacy Policy</a>.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Login;
