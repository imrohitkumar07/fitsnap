import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Upload,
  RotateCcw,
  Plus,
  Sparkles,
  Zap,
  ChefHat,
} from 'lucide-react';
import { compressImage } from '../utils/imageResize';
import { post } from '../api/client';
import { useFoodStore } from '../store/foodStore';
import { toast } from '../components/ui/Toast';
import { QuickAddModal } from '../components/food/QuickAddModal';
import { CustomFoodModal } from '../components/food/CustomFoodModal';
import { RecipeBuilderModal } from '../components/food/RecipeBuilderModal';

export const FoodCapture: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setAnalysisResult } = useFoodStore();

  // Modals state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [customFoodOpen, setCustomFoodOpen] = useState(false);
  const [recipeBuilderOpen, setRecipeBuilderOpen] = useState(false);

  // Photo Scan State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image is too large. Please select a photo under 15MB.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setSelectedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedFile) {
      toast.error('Please select or capture a food photo first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response: any = await post('/food/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 25000,
      });

      const resPayload = response?.data || response;
      const detectedFoods = resPayload?.foods || response?.foods;

      if (detectedFoods && detectedFoods.length > 0) {
        setAnalysisResult({
          foods: detectedFoods,
          photoUrl: previewUrl || undefined,
          predictions: resPayload.predictions || response?.predictions,
          qualityChecks: resPayload.qualityChecks,
          embedding: resPayload.embedding,
          userPrototypeMatches: resPayload.userPrototypeMatches,
          recognitionState: resPayload.recognitionState || response?.recognition_state,
          stateMessage: resPayload.stateMessage,
          calibratedConfidence: resPayload.calibratedConfidence || response?.confidence,
          entropy: resPayload.entropy,
          prototypeDistance: resPayload.prototypeDistance || response?.prototype_distance,
        });
        toast.success(`Identified ${detectedFoods.length} food item!`);
        navigate('/food/confirm');
      } else {
        throw new Error('AI could not identify items in this image.');
      }
    } catch (err: any) {
      console.error('AI Analysis Error:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Photo analysis timed out or could not identify the meal. Please retry.';
      setAnalysisError(msg);
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200 pb-12">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2F5BFF] font-mono">
            FOOD TRACKING
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
            Log Your Meal
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
            Single-photo AI vision meal recognition, portion estimation, and nutrition tracking.
          </p>
        </div>

        {/* Quick Modals Triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 border border-[#2F5BFF]/20 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Quick Add</span>
          </button>
          <button
            onClick={() => setCustomFoodOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white border border-[#0F172A]/10 dark:border-white/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Food</span>
          </button>
          <button
            onClick={() => setRecipeBuilderOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 transition-colors"
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Recipe</span>
          </button>
        </div>
      </div>

      {/* PHOTO SCAN INTERFACE */}
      <div className="space-y-6">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {!previewUrl ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#0F172A]/15 dark:border-white/15 hover:border-[#2F5BFF] dark:hover:border-[#2F5BFF] rounded-card p-8 sm:p-14 text-center cursor-pointer transition-colors bg-white/50 dark:bg-[#12151D]/50 hover:bg-[#2F5BFF]/5"
          >
            <div className="w-16 h-16 rounded-full bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white mb-1">
              Take a photo or upload meal image
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] max-w-sm mx-auto mb-6">
              Drag and drop your food photo here, or browse from your device.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle"
            >
              <Upload className="w-4 h-4" />
              <span>Select Food Photo</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle overflow-hidden">
            <div className="relative aspect-video max-h-96 bg-black/5 dark:bg-black/40 flex items-center justify-center overflow-hidden">
              <img
                src={previewUrl}
                alt="Captured Meal"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setSelectedFile(null);
                }}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                title="Change Photo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Photo Ready for Analysis
                </h4>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  AI-powered meal identification & portion estimation
                </p>
              </div>

              <button
                onClick={handleAnalyzePhoto}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] disabled:opacity-50 transition-colors shadow-subtle w-full sm:w-auto justify-center"
              >
                <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing Plate...' : 'Identify Nutrition'}</span>
              </button>
            </div>
          </div>
        )}

        {analysisError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-xs text-rose-700 dark:text-rose-300">
            {analysisError}
          </div>
        )}
      </div>

      {/* Modals */}
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={() => navigate('/food/log')}
      />

      <CustomFoodModal
        isOpen={customFoodOpen}
        onClose={() => setCustomFoodOpen(false)}
        onSuccess={() => navigate('/food/log')}
      />

      <RecipeBuilderModal
        isOpen={recipeBuilderOpen}
        onClose={() => setRecipeBuilderOpen(false)}
        onSuccess={() => {
          toast.success('Recipe available in your recipes list!');
        }}
      />
    </div>
  );
};

export default FoodCapture;
