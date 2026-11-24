/**
 * FitSnap - ExerciseLibrary Page
 * Filterable directory of 40+ exercises across strength, cardio, yoga, and sports.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { TabBar } from '../components/ui/TabBar';
import { Modal } from '../components/ui/Modal';
import { get, post } from '../api/client';
import { toast } from '../components/ui/Toast';

export const ExerciseLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // New exercise form
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('strength');
  const [newMuscle, setNewMuscle] = useState('chest');
  const [newMet, setNewMet] = useState(5.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExercises = async () => {
    try {
      const res = await get('/workouts/exercises');
      if (res.data) {
        setExercises(res.data);
      }
    } catch (err) {
      console.error('Failed to load exercises:', err);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await post('/workouts/exercises', {
        name: newName.trim(),
        category: newCategory,
        muscleGroup: newMuscle,
        metValue: Number(newMet),
      });

      if (res.data) {
        setExercises((prev) => [res.data, ...prev]);
        toast.success('Custom exercise added!');
        setModalOpen(false);
        setNewName('');
      }
    } catch (err: any) {
      toast.error('Failed to add exercise');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'strength', label: 'Strength' },
    { id: 'cardio', label: 'Cardio' },
    { id: 'yoga', label: 'Yoga' },
    { id: 'sports', label: 'Sports' },
  ];

  const filtered = exercises.filter((ex) => {
    const matchesCategory = category === 'all' || ex.category === category;
    const matchesSearch =
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      (ex.muscleGroup && ex.muscleGroup.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen pb-24 pt-4 px-4 max-w-md mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => navigate('/workout')}
          className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Exercise Library</h1>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="shadow-glow"
        >
          + Custom
        </Button>
      </div>

      {/* Search Input */}
      <Input
        placeholder="Search exercises, muscles (e.g. Squat, Chest)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Categories Tabs */}
      <TabBar
        tabs={categories}
        activeTab={category}
        onChange={(id) => setCategory(id)}
      />

      {/* Exercise List */}
      <div className="space-y-2">
        <div className="text-[11px] text-slate-400 font-semibold px-1">
          Showing {filtered.length} exercises
        </div>

        {filtered.map((ex) => (
          <GlassCard key={ex.id} className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                {ex.category === 'strength' ? '🏋️‍♂️' : ex.category === 'cardio' ? '🏃‍♂️' : ex.category === 'yoga' ? '🧘‍♂️' : '🏸'}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">{ex.name}</h4>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 capitalize">
                  <span>{ex.category}</span>
                  {ex.muscleGroup && (
                    <>
                      <span>•</span>
                      <span className="text-brand-300 font-medium">{ex.muscleGroup}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold block">MET</span>
              <span className="text-xs font-black text-brand-400">{ex.metValue || 4.0}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Custom Exercise Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Custom Exercise"
      >
        <form onSubmit={handleAddCustom} className="space-y-3">
          <Input
            label="Exercise Name"
            placeholder="e.g. Bulgarian Split Squat"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full rounded-2xl bg-slate-900/60 border border-white/15 px-3 py-2 text-xs text-white outline-none"
            >
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
              <option value="yoga">Yoga</option>
              <option value="sports">Sports</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Muscle Group
            </label>
            <select
              value={newMuscle}
              onChange={(e) => setNewMuscle(e.target.value)}
              className="w-full rounded-2xl bg-slate-900/60 border border-white/15 px-3 py-2 text-xs text-white outline-none"
            >
              <option value="chest">Chest</option>
              <option value="back">Back</option>
              <option value="legs">Legs</option>
              <option value="arms">Arms</option>
              <option value="shoulders">Shoulders</option>
              <option value="core">Core</option>
              <option value="full">Full Body</option>
            </select>
          </div>

          <Input
            label="Estimated MET Value"
            type="number"
            step="0.5"
            min={1}
            max={20}
            value={newMet}
            onChange={(e) => setNewMet(Number(e.target.value))}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={isSubmitting}
          >
            Save Exercise
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default ExerciseLibrary;
