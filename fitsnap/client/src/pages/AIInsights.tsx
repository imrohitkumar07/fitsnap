/**
 * FitSnap - AI Nutrition Coach Page
 * Generates personalized daily advice based on real remaining calories and macros.
 * Features contextual suggestion cards, interactive chat, and specific meal recommendations.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  ArrowRight,
  Utensils,
  Droplets,
  Flame,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { get, post } from '../api/client';
import { toast } from '../components/ui/Toast';

export const AIInsights: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [insightData, setInsightData] = useState<any>(null);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      sender: 'coach',
      text: "Hello! I'm your Fitsnap AI Nutrition Coach. I monitor your daily macro targets, logged meals, and energy expenditure to provide real-time recommendations.",
      suggestions: [],
    },
  ]);

  const fetchInsight = async () => {
    setLoading(true);
    try {
      const res = await get('/insights');
      if (res.data) {
        setInsightData(res.data);
      }
    } catch (err) {
      console.error('Failed to load insight:', err);
      toast.error('Failed to load AI Coach insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsight();
  }, []);

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim()) return;

    // Add user message
    const userMsg = { sender: 'user', text: textToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatting(true);

    try {
      const res = await post('/insights/chat', { message: textToSend });
      if (res.data) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'coach',
            text: res.data.reply,
            suggestions: res.data.suggestions || [],
          },
        ]);
      }
    } catch {
      toast.error('AI Coach is temporarily unavailable. Please retry.');
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'coach',
          text: 'I could not process that request right now. Please check your connection and try again.',
          suggestions: [],
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const summary = insightData?.summary || {
    caloriesRemaining: 540,
    calorieGoal: 2200,
    caloriesConsumed: 1660,
    proteinRemaining: 28,
    proteinGoal: 140,
    proteinConsumed: 112,
    waterConsumed: 1750,
    waterGoal: 2500,
    goal: 'maintain',
  };

  const quickPrompts = [
    'What should I eat for dinner tonight?',
    'High-protein snack under 150 kcal',
    'How is my hydration progress?',
    'Did I hit my protein goal today?',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#2F5BFF] font-mono">
          CONTEXT-AWARE NUTRITION INTELLIGENCE
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
          Personalized AI Coach
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
          Real-time dietary recommendations based on your remaining macronutrient targets.
        </p>
      </div>

      {/* Real-time Macro Allowance Snapshot */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-5 sm:p-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] font-mono block mb-3">
          Current Remaining Allowance for Today
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[#2F5BFF]/10 border border-[#2F5BFF]/20">
            <span className="text-[10px] font-bold text-[#2F5BFF] uppercase block">Calories Left</span>
            <span className="text-xl font-bold text-[#0F172A] dark:text-white mt-0.5 block font-mono">
              {summary.caloriesRemaining} kcal
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#2F5BFF]/10 border border-[#2F5BFF]/20">
            <span className="text-[10px] font-bold text-[#2F5BFF] uppercase block">Protein Left</span>
            <span className="text-xl font-bold text-[#0F172A] dark:text-white mt-0.5 block font-mono">
              {summary.proteinRemaining}g
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20">
            <span className="text-[10px] font-bold text-[#10B981] uppercase block">Carbs Left</span>
            <span className="text-xl font-bold text-[#0F172A] dark:text-white mt-0.5 block font-mono">
              {summary.carbsRemaining ?? 45}g
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0284C7]/10 border border-[#0284C7]/20">
            <span className="text-[10px] font-bold text-[#0284C7] uppercase block">Water Needed</span>
            <span className="text-xl font-bold text-[#0F172A] dark:text-white mt-0.5 block font-mono">
              {Math.max(0, summary.waterGoal - summary.waterConsumed)} ml
            </span>
          </div>
        </div>
      </div>

      {/* Primary Coach Observation Card */}
      {insightData?.insight && (
        <div className="p-5 rounded-card bg-white dark:bg-[#12151D] border border-[#2F5BFF]/30 shadow-subtle flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F5BFF] font-mono">
                Daily Nutritional Assessment
              </span>
              <button
                onClick={fetchInsight}
                className="text-xs text-[#94A3B8] hover:text-[#0F172A] flex items-center gap-1"
                title="Refresh Insight"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
            <p className="text-sm font-medium text-[#0F172A] dark:text-white leading-relaxed">
              {insightData.insight}
            </p>
            {insightData.suggestion && (
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] pt-1">
                <span className="font-semibold text-[#16A34A]">Recommendation: </span>
                {insightData.suggestion}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Interactive Coach Q&A Box */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle overflow-hidden flex flex-col h-[520px]">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-[#0F172A]/[0.06] dark:border-white/10 flex items-center justify-between bg-[#F7F8FA] dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#2F5BFF] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-white block">
                Coach Consultation
              </span>
              <span className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Online • Instant Advice
              </span>
            </div>
          </div>

          <span className="text-[11px] text-[#94A3B8]">Powered by FitSnap Sports Nutrition Engine</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#2F5BFF] text-white rounded-br-sm'
                    : 'bg-[#F7F8FA] dark:bg-white/10 text-[#0F172A] dark:text-white rounded-bl-sm border border-[#0F172A]/[0.06]'
                }`}
              >
                {msg.text}
              </div>

              {/* Meal suggestion cards if returned by Coach */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2.5 space-y-2 w-full max-w-md">
                  {msg.suggestions.map((sug: any, sIdx: number) => (
                    <div
                      key={sIdx}
                      className="p-3 rounded-xl bg-white dark:bg-[#1A1F2C] border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-bold text-[#0F172A] dark:text-white">
                        <span>{sug.dish}</span>
                        <span className="font-mono text-[#2F5BFF]">{sug.calories} kcal</span>
                      </div>
                      <div className="flex gap-2 text-[10px] font-semibold text-[#475569] dark:text-[#94A3B8]">
                        <span className="text-[#2F5BFF]">Protein: {sug.protein}</span>
                        <span>•</span>
                        <span className="text-[#10B981]">Carbs: {sug.carbs}</span>
                        <span>•</span>
                        <span className="text-[#F59E0B]">Fat: {sug.fat}</span>
                      </div>
                      <p className="text-[11px] text-[#94A3B8] italic">{sug.why}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isChatting && (
            <div className="flex items-center gap-2 text-xs text-[#94A3B8] p-2">
              <div className="w-2 h-2 rounded-full bg-[#2F5BFF] animate-pulse" />
              <span>Coach is calculating meal recommendations...</span>
            </div>
          )}
        </div>

        {/* Quick Prompts Strip */}
        <div className="px-4 py-2 border-t border-[#0F172A]/[0.06] dark:border-white/10 bg-[#F7F8FA] dark:bg-white/[0.02] overflow-x-auto flex gap-2">
          {quickPrompts.map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendMessage(prompt)}
              className="py-1 px-3 rounded-full bg-white dark:bg-white/10 border border-[#0F172A]/[0.08] text-[11px] text-[#475569] dark:text-[#94A3B8] hover:text-[#2F5BFF] hover:border-[#2F5BFF]/30 whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t border-[#0F172A]/[0.08] dark:border-white/10 flex items-center gap-2 bg-white dark:bg-[#12151D]"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask your coach anything about today's meals, macros, or recipes..."
            disabled={isChatting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-xs sm:text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#2F5BFF]"
          />

          <button
            type="submit"
            disabled={!chatInput.trim() || isChatting}
            className="p-2.5 rounded-xl bg-[#2F5BFF] hover:bg-[#1d41e6] text-white disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

    </div>
  );
};

export default AIInsights;
