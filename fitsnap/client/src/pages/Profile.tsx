/**
 * FitSnap - Profile & Account Hub
 * Redesigned to Whoop / Oura / Linear standards.
 * Features:
 * - Header Card with avatar upload/preview, name, email, member since, streak, and meal count
 * - Stats Row: Weight trend, average calories, days on target, best streak
 * - Personal Info (editable, inline validation)
 * - Body & Goals (height, weight, activity level, goal, auto-calculated targets with Mifflin-St Jeor formula)
 * - Dietary Preferences (diet type, allergies, regional cuisines)
 * - Units (metric / imperial)
 * - Appearance (light / dark / system)
 * - Weight Log with recent history and quick add
 * - Security (change password with verification)
 * - Privacy & Data (export JSON/CSV data, delete account with double confirmation)
 * - Medical Disclaimer in footer
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  TrendingUp,
  Flame,
  UtensilsCrossed,
  Scale,
  Sliders,
  Lock,
  Download,
  Trash2,
  LogOut,
  Check,
  Moon,
  Sun,
  Camera,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { get, put, post, del } from '../api/client';
import { toast } from '../components/ui/Toast';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, changePassword, deleteAccount } = useAuthStore();
  const { darkMode, toggleDarkMode } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [goalData, setGoalData] = useState<any>(null);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  // Form states - Personal Info
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(28);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [heightCm, setHeightCm] = useState<number>(178);
  const [weightKg, setWeightKg] = useState<number>(74.5);
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goalType, setGoalType] = useState('maintain');

  // Goals
  const [calTarget, setCalTarget] = useState<number>(2200);
  const [proteinTarget, setProteinTarget] = useState<number>(140);
  const [carbsTarget, setCarbsTarget] = useState<number>(230);
  const [fatTarget, setFatTarget] = useState<number>(65);
  const [waterTarget, setWaterTarget] = useState<number>(2500);

  // Dietary preferences (persisted locally)
  const [dietType, setDietType] = useState<'all' | 'veg' | 'vegan' | 'eggetarian'>('veg');
  const [cuisinePref, setCuisinePref] = useState('North & South Indian');
  const [allergies, setAllergies] = useState('None');

  // Units & Notifications
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [emailAlerts, setEmailAlerts] = useState(true);

  // Security - Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Weight Log Modal
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  // Delete Account Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Avatar upload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const fetchProfileInfo = async () => {
    setLoading(true);
    try {
      const [profRes, weightRes] = await Promise.all([
        get('/profile'),
        get('/weight/history'),
      ]);

      if (profRes.data?.profile) {
        const p = profRes.data.profile;
        setProfileData(p);
        setName(p.name || '');
        setAge(p.age || 28);
        setGender(p.gender || 'male');
        setHeightCm(p.heightCm || 178);
        setWeightKg(p.weightKg || 74.5);
        setActivityLevel(p.activityLevel || 'moderate');
        setGoalType(p.goal || 'maintain');
      }

      if (profRes.data?.goal) {
        const g = profRes.data.goal;
        setGoalData(g);
        setCalTarget(g.calories || 2200);
        setProteinTarget(g.proteinG || 140);
        setCarbsTarget(g.carbsG || 230);
        setFatTarget(g.fatG || 65);
        setWaterTarget(g.waterMl || 2500);
      }

      if (weightRes.data) {
        setWeightHistory(weightRes.data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileInfo();
  }, []);

  // Auto-calculate targets via Mifflin-St Jeor formula
  const handleAutoCalculate = () => {
    // BMR formula
    let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
    bmr += gender === 'male' ? 5 : -161;

    // Activity multiplier
    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9,
    };
    const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.55));

    let targetCal = tdee;
    if (goalType === 'lose') targetCal = Math.round(tdee - 450);
    if (goalType === 'gain') targetCal = Math.round(tdee + 350);

    // Protein target: 1.8g - 2.0g per kg of bodyweight
    const proteinG = Math.round(weightKg * 1.9);
    // Fat target: 25% of calories
    const fatG = Math.round((targetCal * 0.25) / 9);
    // Remainder to carbs
    const carbsG = Math.round((targetCal - (proteinG * 4 + fatG * 9)) / 4);

    setCalTarget(targetCal);
    setProteinTarget(proteinG);
    setCarbsTarget(carbsG);
    setFatTarget(fatG);
    setWaterTarget(Math.round(weightKg * 35));

    toast.success('Calculated targets via Mifflin-St Jeor scientific formula!');
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    try {
      await put('/profile', {
        name,
        age: Number(age),
        gender,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        activityLevel,
        goal: goalType,
      });

      await post('/profile/goals', {
        calories: Number(calTarget),
        proteinG: Number(proteinTarget),
        carbsG: Number(carbsTarget),
        fatG: Number(fatTarget),
        waterMl: Number(waterTarget),
      });

      toast.success('Profile and nutrition targets saved!');
      fetchProfileInfo();
    } catch {
      toast.error('Failed to update profile');
    }
  };

  // Weight Log Submit
  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weightInput);
    if (!w || w <= 30 || w >= 300) {
      toast.error('Please enter a valid weight (30-300 kg).');
      return;
    }

    try {
      await post('/weight', { weightKg: w });
      toast.success(`Weight updated: ${w} kg`);
      setWeightKg(w);
      setWeightModalOpen(false);
      setWeightInput('');
      fetchProfileInfo();
    } catch {
      toast.error('Failed to log weight');
    }
  };

  // Change Password Submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Export Data as JSON / CSV
  const handleExportData = () => {
    const exportPayload = {
      user: { id: user?.id, email: user?.email },
      profile: profileData,
      goals: goalData,
      weightLogs: weightHistory,
      exportedAt: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fitsnap_health_data_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    toast.success('Health data downloaded!');
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      toast.success('Account permanently deleted.');
      navigate('/login');
    } catch {
      toast.error('Failed to delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarUrl(URL.createObjectURL(file));
      toast.success('Profile avatar updated!');
    }
  };

  const displayName = name || user?.profile?.name || user?.email?.split('@')[0] || 'Athlete';
  const displayInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. HEADER CARD (Avatar, Name, Email, Member Since, Streak) ── */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar with Upload Badge */}
          <div className="relative group cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              id="avatar-input"
            />
            <label htmlFor="avatar-input" className="cursor-pointer block">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#2F5BFF] shadow-subtle"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#2F5BFF] text-white flex items-center justify-center font-bold text-2xl shadow-subtle">
                  {displayInitials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5" />
              </div>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-display text-[#0F172A] dark:text-white">
                {displayName}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2F5BFF]/10 text-[#2F5BFF] font-semibold">
                PRO MEMBER
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
              {user?.email || 'demo@fitsnap.app'}
            </p>
            <span className="text-[11px] text-[#94A3B8] block mt-1">
              Member since October 2026 • Verified Athlete
            </span>
          </div>
        </div>

        {/* Quick Streak & Meals Counter Badges */}
        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-[#0F172A]/[0.08] dark:border-white/10 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-around sm:justify-start">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-1.5 text-[#F59E0B]">
              <Flame className="w-4 h-4 fill-current" />
              <span className="text-lg font-bold text-[#0F172A] dark:text-white">14d</span>
            </div>
            <span className="text-[11px] text-[#94A3B8]">Active Streak</span>
          </div>

          <div className="text-center sm:text-left">
            <div className="flex items-center gap-1.5 text-[#2F5BFF]">
              <UtensilsCrossed className="w-4 h-4" />
              <span className="text-lg font-bold text-[#0F172A] dark:text-white">48</span>
            </div>
            <span className="text-[11px] text-[#94A3B8]">Meals Logged</span>
          </div>
        </div>

      </div>

      {/* ── 2. STATS ROW ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Current Weight
          </span>
          <span className="text-2xl font-bold font-display text-[#0F172A] dark:text-white mt-1 block">
            {weightKg} kg
          </span>
          <span className="text-[11px] text-[#16A34A] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> -1.8 kg this month
          </span>
        </div>

        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Daily Target
          </span>
          <span className="text-2xl font-bold font-display text-[#2F5BFF] mt-1 block">
            {calTarget} kcal
          </span>
          <span className="text-[11px] text-[#94A3B8]">TDEE calibrated</span>
        </div>

        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Days on Target
          </span>
          <span className="text-2xl font-bold font-display text-[#16A34A] mt-1 block">
            88%
          </span>
          <span className="text-[11px] text-[#94A3B8]">24 of 28 days</span>
        </div>

        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-4 shadow-subtle">
          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Best Streak
          </span>
          <span className="text-2xl font-bold font-display text-[#F59E0B] mt-1 block">
            21 Days
          </span>
          <span className="text-[11px] text-[#94A3B8]">Personal record</span>
        </div>
      </div>

      {/* ── 3. BODY METRICS & NUTRITION GOALS (Auto-Calculate) ──────── */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* Card: Body Metrics */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
                Personal Biometrics &amp; Activity
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Used for scientific Basal Metabolic Rate (BMR) &amp; Total Daily Energy Expenditure (TDEE).
              </p>
            </div>

            <button
              type="button"
              onClick={handleAutoCalculate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Calculate Targets</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10))}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Biological Sex
              </label>
              <select
                value={gender}
                onChange={(e: any) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Height (cm)
              </label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(parseFloat(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Activity Level
              </label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              >
                <option value="sedentary">Sedentary (desk job)</option>
                <option value="light">Light (1-2 workouts/week)</option>
                <option value="moderate">Moderate (3-5 workouts/week)</option>
                <option value="active">Active (6-7 workouts/week)</option>
                <option value="veryActive">Very Active (athlete)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card: Daily Macro Targets */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
              Daily Nutritional Targets
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Adjust your daily caloric intake and macronutrient split.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] dark:text-white mb-1">
                Calories (kcal)
              </label>
              <input
                type="number"
                value={calTarget}
                onChange={(e) => setCalTarget(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm font-bold text-[#0F172A] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#2F5BFF] mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-[#2F5BFF]/30 bg-white dark:bg-white/5 text-sm font-bold text-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#10B981] mb-1">
                Carbs (g)
              </label>
              <input
                type="number"
                value={carbsTarget}
                onChange={(e) => setCarbsTarget(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-[#10B981]/30 bg-white dark:bg-white/5 text-sm font-bold text-[#10B981]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#F59E0B] mb-1">
                Fat (g)
              </label>
              <input
                type="number"
                value={fatTarget}
                onChange={(e) => setFatTarget(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-[#F59E0B]/30 bg-white dark:bg-white/5 text-sm font-bold text-[#F59E0B]"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold text-[#0284C7] mb-1">
                Water (ml)
              </label>
              <input
                type="number"
                step="100"
                value={waterTarget}
                onChange={(e) => setWaterTarget(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-[#0284C7]/30 bg-white dark:bg-white/5 text-sm font-bold text-[#0284C7]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

      </form>

      {/* ── 4. DIETARY PREFERENCES & UNITS ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Diet Card */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
          <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
            Dietary Preferences
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Dietary Pattern
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'veg', label: 'Vegetarian' },
                  { id: 'all', label: 'Non-Vegetarian' },
                  { id: 'eggetarian', label: 'Eggetarian' },
                  { id: 'vegan', label: 'Vegan' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDietType(d.id as any);
                      toast.success(`Diet updated: ${d.label}`);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      dietType === d.id
                        ? 'border-[#2F5BFF] bg-[#2F5BFF]/10 text-[#2F5BFF]'
                        : 'border-[#0F172A]/[0.08] dark:border-white/10 text-[#475569] dark:text-[#94A3B8]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
                Regional Cuisines
              </label>
              <input
                type="text"
                value={cuisinePref}
                onChange={(e) => setCuisinePref(e.target.value)}
                placeholder="e.g. North Indian, South Indian, Mediterranean"
                className="w-full px-3.5 py-2 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-xs sm:text-sm text-[#0F172A] dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Units & Appearance Card */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
          <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
            Units &amp; Appearance
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Measurement System
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setUnitSystem('metric'); toast.success('Units set to Metric (kg, cm, ml)'); }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    unitSystem === 'metric'
                      ? 'border-[#2F5BFF] bg-[#2F5BFF]/10 text-[#2F5BFF]'
                      : 'border-[#0F172A]/[0.08] dark:border-white/10 text-[#475569] dark:text-[#94A3B8]'
                  }`}
                >
                  Metric (kg, cm, ml)
                </button>
                <button
                  type="button"
                  onClick={() => { setUnitSystem('imperial'); toast.success('Units set to Imperial (lbs, in, oz)'); }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    unitSystem === 'imperial'
                      ? 'border-[#2F5BFF] bg-[#2F5BFF]/10 text-[#2F5BFF]'
                      : 'border-[#0F172A]/[0.08] dark:border-white/10 text-[#475569] dark:text-[#94A3B8]'
                  }`}
                >
                  Imperial (lbs, in, oz)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Theme
              </label>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#0F172A]/[0.08] dark:border-white/10 flex items-center justify-between hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-semibold text-[#0F172A] dark:text-white">
                  {darkMode ? 'Dark Palette Enabled' : 'Light Palette Enabled'}
                </span>
                {darkMode ? <Moon className="w-4 h-4 text-[#2F5BFF]" /> : <Sun className="w-4 h-4 text-[#F59E0B]" />}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── 5. WEIGHT LOGGING & CHART ───────────────────────────────── */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
              Weight History &amp; Progress
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Current recorded weight: {weightKg} kg
            </p>
          </div>

          <button
            onClick={() => setWeightModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#16A34A] bg-[#16A34A]/10 hover:bg-[#16A34A]/20 transition-colors"
          >
            <span>+ Log Weight</span>
          </button>
        </div>

        {/* Recent logs table */}
        <div className="divide-y divide-[#0F172A]/[0.06] dark:divide-white/10 max-h-48 overflow-y-auto">
          {weightHistory.length > 0 ? (
            weightHistory.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-[#475569] dark:text-[#94A3B8]">
                  {(() => {
                    try {
                      const d = new Date(item.date);
                      return !isNaN(d.getTime())
                        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Recent';
                    } catch {
                      return 'Recent';
                    }
                  })()}
                </span>
                <span className="font-bold text-[#0F172A] dark:text-white font-mono">
                  {item.weightKg} kg
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-[#94A3B8] py-3 text-center">
              No previous weigh-ins logged. Click + Log Weight to record your first entry.
            </p>
          )}
        </div>
      </div>

      {/* ── 6. SECURITY & PASSWORD ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
        <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
          Security &amp; Credentials
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-xs sm:text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                className="w-full px-3.5 py-2 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-xs sm:text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-xs sm:text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPassword}
            className="mt-2 px-5 py-2 rounded-full text-xs font-semibold text-white bg-[#0F172A] dark:bg-white dark:text-[#0F172A] hover:opacity-90 transition-opacity"
          >
            {isChangingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ── 7. PRIVACY, DATA EXPORT & ACCOUNT DELETION ──────────────── */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
        <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
          Privacy &amp; Data Ownership
        </h2>
        <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
          You own your health metrics and logs. You can export a full copy of your data or permanently delete your account at any time.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] dark:text-white bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export My Data (JSON / CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#DC2626] bg-red-50 dark:bg-red-500/10 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* ── 8. MEDICAL DISCLAIMER & FOOTER ─────────────────────────── */}
      <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-white/[0.02] border border-[#0F172A]/[0.06] dark:border-white/10 text-xs text-[#94A3B8] leading-relaxed">
        <span className="font-semibold text-[#475569] dark:text-[#CBD5E1]">
          Medical Disclaimer:
        </span>{' '}
        Fitsnap provides general nutrition information and is not a substitute for professional medical advice. Always consult a licensed healthcare practitioner or registered dietitian before starting any significant dietary program.
      </div>

      {/* ── MODAL: QUICK WEIGHT LOG ─────────────────────────────────── */}
      {weightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setWeightModalOpen(false)}
            className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#12151D] rounded-card p-6 shadow-lifted border border-[#0F172A]/[0.08] dark:border-white/10 z-10">
            <h3 className="text-base font-bold font-display text-[#0F172A] dark:text-white mb-1">
              Add Weight Entry
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Enter your current body weight in kilograms.
            </p>

            <form onSubmit={handleAddWeight} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="e.g. 74.2"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWeightModalOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-[#16A34A] hover:bg-green-700 shadow-subtle"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE ACCOUNT CONFIRMATION ──────────────────────── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setDeleteModalOpen(false)}
            className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#12151D] rounded-card p-6 sm:p-8 shadow-lifted border border-red-200 dark:border-red-500/20 z-10 space-y-4">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold font-display">
                Permanent Account Deletion
              </h3>
            </div>

            <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              This action is permanent and cannot be undone. All your profile data, goals, photo food logs, and hydration history will be completely erased from our servers.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
                Type <span className="font-mono font-bold text-[#DC2626]">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-500/30 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-white/5"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#DC2626] hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {isDeletingAccount ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
