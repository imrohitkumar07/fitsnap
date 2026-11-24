/**
 * FitSnap - Dedicated Registration Page
 * Aesthetic: Restrained, modern health-tech (Whoop / Linear / Stripe level)
 * Design Tokens: #FFFFFF, #F7F8FA, #0F172A, #475569, #94A3B8, #2F5BFF, #16A34A
 * 
 * Features:
 * - Client-side validation with inline field errors
 * - Prevents double-submit with loading spinner and disabled state
 * - Clear inline error banner on duplicate account with dual actions:
 *   "Log in instead" (preserves email) and "Forgot password?"
 * - Instant 1-Click Demo login button
 * - Clean password visibility toggle
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Scan,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/ui/Toast';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Field-level error messages
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Server error response
  const [serverError, setServerError] = useState('');
  const [serverErrorCode, setServerErrorCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side validation
  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setServerError('');
    setServerErrorCode('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email is required.');
      isValid = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      isValid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    }

    return isValid;
  };

  // 1-Click Demo login
  const handleDemoLogin = async () => {
    try {
      setServerError('');
      setServerErrorCode('');
      await login('demo@fitsnap.app', 'password123', true);
      toast.success('Welcome back to Fitsnap!');
      navigate('/dashboard');
    } catch {
      toast.error('Unable to sign in to demo account. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setServerError('');
    setServerErrorCode('');

    try {
      await register(email.trim(), password);
      toast.success('Account created! Let us set up your profile.');
      navigate('/onboarding');
    } catch (err: any) {
      const code = err.response?.data?.code || '';
      const msg = err.response?.data?.error || err.message || 'Registration failed. Please try again.';
      setServerErrorCode(code);
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmailExists = serverErrorCode === 'EMAIL_EXISTS' || serverError.toLowerCase().includes('already exists');

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-[#2F5BFF] selection:text-white">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/login" className="inline-flex items-center gap-2 mb-4 focus:outline-none">
          <div className="w-10 h-10 rounded-xl bg-[#2F5BFF] flex items-center justify-center text-white shadow-subtle">
            <Scan className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-2xl text-[#0F172A] tracking-tight">
            Fitsnap
          </span>
        </Link>
        <h2 className="text-2xl font-bold font-display text-[#0F172A] tracking-tight">
          Create your Fitsnap account
        </h2>
        <p className="mt-2 text-sm text-[#475569]">
          Log nutrition effortlessly with AI-powered meal recognition.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-[#0F172A]/[0.08] shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          
          {/* Instant 1-Click Demo Login */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading || isSubmitting}
            className="w-full mb-5 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/15 border border-[#2F5BFF]/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>Instant 1-Click Demo Login (demo@fitsnap.app)</span>
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#0F172A]/[0.08]" />
            <span className="text-[10px] font-mono uppercase text-[#94A3B8]">or register with email</span>
            <div className="flex-1 h-px bg-[#0F172A]/[0.08]" />
          </div>

          {/* DUPLICATE ACCOUNT ACTIONABLE BANNER */}
          {isEmailExists && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-xl bg-blue-50 border border-[#2F5BFF]/30 text-xs text-[#0F172A] space-y-2.5"
            >
              <div className="flex items-center gap-2 font-semibold text-[#0F172A]">
                <AlertCircle className="w-4 h-4 text-[#2F5BFF] flex-shrink-0" />
                <span>An account with this email already exists.</span>
              </div>
              <p className="text-[11px] text-[#475569] leading-relaxed">
                You already have a Fitsnap profile with this email. Would you like to sign in or recover your password?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(`/login?mode=signin&email=${encodeURIComponent(email)}`)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle"
                >
                  Log in instead
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/login?mode=forgot&email=${encodeURIComponent(email)}`)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#475569] bg-white border border-[#0F172A]/[0.1] hover:bg-[#F7F8FA] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </motion.div>
          )}

          {/* General Server Error Banner */}
          {serverError && !isEmailExists && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </motion.div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white border ${
                    emailError ? 'border-red-500 focus:ring-red-200' : 'border-[#0F172A]/[0.15] focus:border-[#2F5BFF]'
                  } text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:ring-2 focus:ring-[#2F5BFF]/15`}
                />
              </div>
              {emailError && (
                <p className="mt-1 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Minimum 6 characters"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-10 py-2.5 rounded-xl text-sm bg-white border ${
                    passwordError ? 'border-red-500 focus:ring-red-200' : 'border-[#0F172A]/[0.15] focus:border-[#2F5BFF]'
                  } text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:ring-2 focus:ring-[#2F5BFF]/15`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#0F172A]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white border ${
                    confirmPasswordError ? 'border-red-500 focus:ring-red-200' : 'border-[#0F172A]/[0.15] focus:border-[#2F5BFF]'
                  } text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:ring-2 focus:ring-[#2F5BFF]/15`}
                />
              </div>
              {confirmPasswordError && (
                <p className="mt-1 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {confirmPasswordError}
                </p>
              )}
            </div>

            {/* Submit Button with Loading State */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full py-3 rounded-full text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Social Proof / Security */}
          <div className="mt-6 pt-5 border-t border-[#0F172A]/[0.08] flex items-center justify-center gap-2 text-xs text-[#475569]">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            <span>Encrypted passwords & private nutrition data</span>
          </div>

          {/* Footer Navigation */}
          <div className="mt-4 text-center">
            <p className="text-xs text-[#475569]">
              Already have an account?{' '}
              <Link
                to="/login?mode=signin"
                className="text-[#2F5BFF] hover:underline font-semibold ml-1"
              >
                Sign in
              </Link>
            </p>
          </div>

        </div>

        {/* Medical disclaimer note */}
        <p className="mt-6 text-center text-[11px] text-[#94A3B8] max-w-sm mx-auto leading-relaxed">
          Fitsnap provides general nutrition and dietary information for informational purposes only. It is not intended as medical advice.
        </p>
      </div>
    </div>
  );
};

export default Register;
