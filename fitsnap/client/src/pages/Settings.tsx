/**
 * FitSnap - Comprehensive Settings & Localization Page
 * Configures graphics ("Reduce 3D effects"), OLED dark mode, measurement units,
 * English/Hindi language localization, reminder schedules, and quiet hours.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Globe,
  Gauge,
  Moon,
  Bell,
  Clock,
  Sparkles,
  Check,
  Send,
  Trash2,
  Sliders,
  ShieldCheck,
  Brain,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation, Language } from '../i18n';
import { api } from '../api/client';
import { toast } from '../components/ui/Toast';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    reduce3D,
    toggleReduce3D,
    darkMode,
    toggleDarkMode,
    language,
    setLanguage,
    units,
    setUnits,
  } = useSettingsStore();

  const [breakfastTime, setBreakfastTime] = useState('08:30');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('20:00');
  const [waterInterval, setWaterInterval] = useState(90);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Learned Prototypes state
  const [prototypes, setPrototypes] = useState<any[]>([]);
  const [loadingPrototypes, setLoadingPrototypes] = useState(false);

  const loadPrototypes = async () => {
    try {
      setLoadingPrototypes(true);
      const res = await api.get('/api/settings/prototypes');
      if (res.data?.success) {
        setPrototypes(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load prototypes:', err);
    } finally {
      setLoadingPrototypes(false);
    }
  };

  const handleDeletePrototype = async (foodName: string) => {
    try {
      await api.delete(`/api/settings/prototypes/${encodeURIComponent(foodName)}`);
      toast.success(`Removed prototype for "${foodName}"`);
      loadPrototypes();
    } catch (err) {
      toast.error('Failed to delete prototype');
    }
  };

  useEffect(() => {
    loadPrototypes();
  }, []);

  // Load server-side reminder settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.get('/api/settings');
        if (res.data?.success && res.data.data?.reminders) {
          const rem = res.data.data.reminders;
          if (rem.breakfastTime) setBreakfastTime(rem.breakfastTime);
          if (rem.lunchTime) setLunchTime(rem.lunchTime);
          if (rem.dinnerTime) setDinnerTime(rem.dinnerTime);
          if (rem.waterInterval) setWaterInterval(rem.waterInterval);
          if (rem.quietHoursStart) setQuietStart(rem.quietHoursStart);
          if (rem.quietHoursEnd) setQuietEnd(rem.quietHoursEnd);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await api.put('/api/settings', {
        preferences: {
          reduce3dEffects: reduce3D,
          language,
        },
        reminders: {
          breakfastTime,
          lunchTime,
          dinnerTime,
          waterInterval: Number(waterInterval),
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
        },
      });

      if (res.data?.success) {
        toast.success(t('success'));
      }
    } catch (err) {
      toast.error('Failed to save settings to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      const res = await api.post('/api/settings/test-notification', {
        title: language === 'hi' ? 'भोजन का समय! 🥗' : 'Time for Lunch! 🥗',
        message:
          language === 'hi'
            ? 'अपने लक्ष्यों को बनाए रखने के लिए अपने भोजन का फोटो लें।'
            : "Don't forget to snap your meal to stay on track with your macros.",
      });

      if (res.data?.success) {
        toast.success(
          language === 'hi'
            ? 'परीक्षण सूचना सफलतापूर्वक भेजी गई!'
            : 'Test notification sent to in-app inbox!'
        );
      }
    } catch (err) {
      toast.error('Failed to send test notification.');
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    toast.success('Local cache cleared. Please re-login.');
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-[#0F172A] dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-[#2F5BFF]" />
            {t('settings_title')}
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1">
            Personalize your display, language, notifications, and measurement standards.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="py-2.5 px-5 rounded-xl text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Check className="w-4 h-4" />
          {isSaving ? t('loading') : t('save')}
        </button>
      </div>

      {/* Language & Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Selection */}
        <div className="bg-white dark:bg-[#12151D] p-5 rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle space-y-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF]">
              <Globe className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                {t('settings_language')}
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Select primary interface language
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setLanguage('en')}
              className={`p-3 rounded-xl border text-left transition-all ${
                language === 'en'
                  ? 'border-[#2F5BFF] bg-[#2F5BFF]/5 ring-1 ring-[#2F5BFF]'
                  : 'border-[#0F172A]/[0.08] dark:border-white/10 hover:border-[#2F5BFF]/40'
              }`}
            >
              <div className="font-bold text-sm text-[#0F172A] dark:text-white">English</div>
              <div className="text-[11px] text-[#94A3B8]">Default (US / Global)</div>
            </button>

            <button
              onClick={() => setLanguage('hi')}
              className={`p-3 rounded-xl border text-left transition-all ${
                language === 'hi'
                  ? 'border-[#2F5BFF] bg-[#2F5BFF]/5 ring-1 ring-[#2F5BFF]'
                  : 'border-[#0F172A]/[0.08] dark:border-white/10 hover:border-[#2F5BFF]/40'
              }`}
            >
              <div className="font-bold text-sm text-[#0F172A] dark:text-white">हिन्दी (Hindi)</div>
              <div className="text-[11px] text-[#94A3B8]">पूर्ण भारतीय भाषा समर्थन</div>
            </button>
          </div>
        </div>

        {/* Measurement Units */}
        <div className="bg-white dark:bg-[#12151D] p-5 rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle space-y-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#16A34A]/10 text-[#16A34A]">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                {t('settings_units')}
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Preferred units for weights, heights & volumes
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setUnits('metric')}
              className={`p-3 rounded-xl border text-left transition-all ${
                units === 'metric'
                  ? 'border-[#16A34A] bg-[#16A34A]/5 ring-1 ring-[#16A34A]'
                  : 'border-[#0F172A]/[0.08] dark:border-white/10 hover:border-[#16A34A]/40'
              }`}
            >
              <div className="font-bold text-sm text-[#0F172A] dark:text-white">Metric</div>
              <div className="text-[11px] text-[#94A3B8]">Kilograms, cm, Milliliters</div>
            </button>

            <button
              onClick={() => setUnits('imperial')}
              className={`p-3 rounded-xl border text-left transition-all ${
                units === 'imperial'
                  ? 'border-[#16A34A] bg-[#16A34A]/5 ring-1 ring-[#16A34A]'
                  : 'border-[#0F172A]/[0.08] dark:border-white/10 hover:border-[#16A34A]/40'
              }`}
            >
              <div className="font-bold text-sm text-[#0F172A] dark:text-white">Imperial</div>
              <div className="text-[11px] text-[#94A3B8]">Pounds, Inches, Fl Oz</div>
            </button>
          </div>
        </div>
      </div>

      {/* Graphics & Theme Controls */}
      <div className="bg-white dark:bg-[#12151D] p-6 rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle space-y-6">
        <h3 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
          {t('settings_graphics')}
        </h3>

        {/* Reduce 3D Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF]">
              <Gauge className="w-5 h-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-[#0F172A] dark:text-white">
                {t('settings_reduce_3d')}
              </div>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-w-lg mt-0.5">
                {t('settings_reduce_3d_desc')}
              </p>
            </div>
          </div>

          <button
            onClick={toggleReduce3D}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${
              reduce3D ? 'bg-[#2F5BFF]' : 'bg-slate-300 dark:bg-white/20'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                reduce3D ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* OLED Dark Theme Toggle */}
        <div className="flex items-center justify-between py-2 border-t border-[#0F172A]/[0.06] dark:border-white/5 pt-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
              <Moon className="w-5 h-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-[#0F172A] dark:text-white">
                {t('settings_dark_mode')}
              </div>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-w-lg mt-0.5">
                {t('settings_dark_mode_desc')}
              </p>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out flex-shrink-0 ${
              darkMode ? 'bg-[#2F5BFF]' : 'bg-slate-300 dark:bg-white/20'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                darkMode ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Reminder Schedules & Quiet Hours */}
      <div className="bg-white dark:bg-[#12151D] p-6 rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B]">
              <Bell className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                {t('settings_reminders')}
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Automated reminders for meals, fluid hydration, and fast tracking
              </p>
            </div>
          </div>

          <button
            onClick={handleTestNotification}
            className="py-1.5 px-3 rounded-lg text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {t('settings_test_notif')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-[#94A3B8] uppercase block mb-1">
              Breakfast Prompt
            </label>
            <input
              type="time"
              value={breakfastTime}
              onChange={(e) => setBreakfastTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#94A3B8] uppercase block mb-1">
              Lunch Prompt
            </label>
            <input
              type="time"
              value={lunchTime}
              onChange={(e) => setLunchTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#94A3B8] uppercase block mb-1">
              Dinner Prompt
            </label>
            <input
              type="time"
              value={dinnerTime}
              onChange={(e) => setDinnerTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 text-sm font-mono"
            />
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="pt-4 border-t border-[#0F172A]/[0.06] dark:border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#94A3B8]" />
            <span className="text-xs font-bold text-[#94A3B8] uppercase">
              {t('settings_quiet_hours')} (Do Not Disturb)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-[#475569] dark:text-[#94A3B8] block mb-1">
                Start Quiet Hours
              </span>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 text-sm font-mono"
              />
            </div>
            <div>
              <span className="text-xs text-[#475569] dark:text-[#94A3B8] block mb-1">
                End Quiet Hours
              </span>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Learned Food Prototypes (From Your Corrections) */}
      <div className="bg-white dark:bg-[#12151D] p-6 rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF]">
              <Brain className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <span>Learned Food Prototypes</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {prototypes.length} Learned
                </span>
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                Food dishes learned automatically from your earlier photo corrections without retraining.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Callout */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-[#2F5BFF] mt-0.5" />
          <p className="leading-relaxed">
            <strong>Privacy Notice:</strong> FitSnap stores only mathematical 512-number vector embeddings, never your meal photos. These embeddings are compared locally on your device to recognise dishes from your earlier photos.
          </p>
        </div>

        {/* Prototypes List */}
        {loadingPrototypes ? (
          <div className="text-center py-6 text-xs text-[#94A3B8]">Loading learned prototypes...</div>
        ) : prototypes.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-xl border border-dashed border-[#0F172A]/10 dark:border-white/10">
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              No learned food prototypes yet. When you correct or choose unknown foods from photos, FitSnap learns their visual embeddings to recognize them automatically next time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#0F172A]/[0.06] dark:divide-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 rounded-xl overflow-hidden">
            {prototypes.map((proto: any) => (
              <div
                key={proto.foodName}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-[#0F172A] dark:text-white block">
                    {proto.foodName}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">
                    {proto.sampleCount} photos recorded • Last updated{' '}
                    {new Date(proto.lastLearnedAt).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => handleDeletePrototype(proto.foodName)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title={`Delete prototype for ${proto.foodName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cache & Diagnostics */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#12151D] border border-[#0F172A]/[0.08] dark:border-white/10 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">Local Storage & Cache</h4>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
            Reset local auth tokens and cached offline data.
          </p>
        </div>

        <button
          onClick={handleClearCache}
          className="py-2 px-3.5 rounded-xl text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 hover:bg-[#DC2626]/20 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Cache
        </button>
      </div>
    </div>
  );
};

export default Settings;
