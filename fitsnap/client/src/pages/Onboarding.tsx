/**
 * FitSnap - Onboarding Flow
 * 4-step personalized setup using Mifflin-St Jeor formula with OnboardingScene3D.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SceneWrapper } from '../components/three/SceneWrapper';
import { OnboardingScene3D } from '../components/three/OnboardingScene3D';
import { useProfile } from '../hooks/useProfile';
import {
  calculateBMR,
  calculateTDEE,
  calculateDefaultGoals,
} from '../utils/nutrition';
import { toast } from '../components/ui/Toast';
import type { ActivityLevel, GoalType, Gender } from '../../../shared/types';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { updateProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<Gender>('male');
  const [heightCm, setHeightCm] = useState<number>(175);
  const [weightKg, setWeightKg] = useState<number>(70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<GoalType>('maintain');

  // Real-time calculations
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  const targets = calculateDefaultGoals(tdee, goal);

  const handleNext = () => {
    if (step === 0 && !name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      await updateProfile({
        name,
        age: Number(age),
        gender,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        activityLevel,
        goal,
      });
      toast.success('Your personalized plan is ready!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-12 max-w-md mx-auto flex flex-col justify-between">
      {/* Top 3D floating scene */}
      <div className="relative">
        <SceneWrapper height="200px" iconType="general">
          <OnboardingScene3D step={step} />
        </SceneWrapper>

        {/* Step progress pills */}
        <div className="flex justify-center gap-2 mt-2">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-8 bg-brand-500 shadow-glow'
                  : s < step
                  ? 'w-4 bg-brand-400/50'
                  : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <GlassCard className="mt-4 my-auto">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-white">Let's get to know you</h2>
              <p className="text-xs text-slate-400 mt-1">We'll tailor your daily macro targets</p>
            </div>

            <Input
              label="Your Name"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                Biological Gender
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['male', 'female'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-3 rounded-2xl text-sm font-semibold capitalize transition-all ${
                      gender === g
                        ? 'bg-brand-500 text-white shadow-glow border border-brand-400'
                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Age (Years)"
              type="number"
              min={14}
              max={100}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-white">Your Body Metrics</h2>
              <p className="text-xs text-slate-400 mt-1">For precision Mifflin-St Jeor metabolic rate</p>
            </div>

            <Input
              label="Height (cm)"
              type="number"
              min={100}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
            />

            <Input
              label="Current Weight (kg)"
              type="number"
              min={30}
              max={300}
              step="0.5"
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
            />

            <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300">
              💡 Basal Metabolic Rate (BMR): <span className="font-bold">{Math.round(bmr)} kcal/day</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-white">Lifestyle & Goal</h2>
              <p className="text-xs text-slate-400 mt-1">How active are you, and what's your focus?</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                Activity Level
              </label>
              <div className="space-y-2">
                {[
                  { id: 'sedentary', label: 'Sedentary', sub: 'Desk job, little workout' },
                  { id: 'light', label: 'Lightly Active', sub: '1-3 workout days/wk' },
                  { id: 'moderate', label: 'Moderately Active', sub: '3-5 workout days/wk' },
                  { id: 'active', label: 'Very Active', sub: '6-7 workout days/wk' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActivityLevel(act.id as ActivityLevel)}
                    className={`w-full p-3 rounded-2xl text-left transition-all border ${
                      activityLevel === act.id
                        ? 'bg-brand-500/20 border-brand-400 shadow-glow text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">{act.label}</div>
                    <div className="text-[10px] text-slate-400">{act.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                Primary Goal
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'lose', label: 'Lose Fat' },
                  { id: 'maintain', label: 'Maintain' },
                  { id: 'gain', label: 'Build Muscle' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id as GoalType)}
                    className={`py-3 rounded-2xl text-xs font-bold transition-all border ${
                      goal === g.id
                        ? 'bg-brand-500 text-white shadow-glow border-brand-400'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-white">Your Custom Plan</h2>
              <p className="text-xs text-slate-400 mt-1">Calculated scientifically for your body & goal</p>
            </div>

            <div className="p-4 rounded-3xl bg-gradient-to-br from-brand-600/30 to-brand-900/40 border border-brand-500/40 text-center shadow-glow">
              <span className="text-xs font-bold text-brand-300 uppercase tracking-wider">
                Daily Calorie Target
              </span>
              <div className="text-4xl font-black text-white mt-1">
                {targets.calories} <span className="text-sm font-semibold text-slate-300">kcal</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Maintenance TDEE: {tdee} kcal
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] font-bold text-macro-protein uppercase">Protein</span>
                <div className="text-base font-black text-white">{targets.proteinG}g</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] font-bold text-macro-carbs uppercase">Carbs</span>
                <div className="text-base font-black text-white">{targets.carbsG}g</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] font-bold text-macro-fat uppercase">Fat</span>
                <div className="text-base font-black text-white">{targets.fatG}g</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-center justify-between">
              <span>💧 Recommended Water Intake:</span>
              <span className="font-bold">{targets.waterMl} ml / day</span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Bottom Action Buttons */}
      <div className="flex gap-3 mt-4">
        {step > 0 && (
          <Button
            variant="secondary"
            size="lg"
            className="w-1/3"
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        )}

        <Button
          variant="primary"
          size="lg"
          className={step === 0 ? 'w-full' : 'w-2/3'}
          onClick={step === 3 ? handleFinish : handleNext}
          isLoading={isSubmitting}
        >
          {step === 3 ? "Let's Go!" : 'Continue'}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
