/**
 * FitSnap Server - Voice Food Parser Service
 * Deterministic grammar-based parser for spoken meal sentences in English & Hinglish.
 * Fully offline, rule-based, zero-cloud.
 */

import { parseSpokenMealGrammar } from './voiceMealGrammarParser.js';
import { groundFoodItems } from './foodMatcher.js';

export interface ParsedFoodItem {
  name: string;
  portionG: number;
  portionLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  confidence: number;
  isAiEstimate: boolean;
  alternatives?: any[];
}

/**
 * Parses a spoken transcript into structured food items and grounds them against the local database.
 */
export async function parseVoiceTranscript(transcript: string): Promise<ParsedFoodItem[]> {
  const cleanText = transcript.trim();
  if (!cleanText) return [];

  // Parse multi-item grammar deterministically
  const grammarItems = parseSpokenMealGrammar(cleanText);

  if (grammarItems.length === 0) {
    // Fallback single item
    const fallbackItem: ParsedFoodItem = {
      name: cleanText.charAt(0).toUpperCase() + cleanText.slice(1),
      portionG: 150,
      portionLabel: '1 serving (150g)',
      calories: 200,
      proteinG: 8,
      carbsG: 25,
      fatG: 7,
      fiberG: 3,
      confidence: 0.80,
      isAiEstimate: true,
    };
    return groundFoodItems([fallbackItem]) as Promise<ParsedFoodItem[]>;
  }

  // Ground parsed foods against local reference database (USDA + Indian certified)
  const grounded = await groundFoodItems(grammarItems);
  return grounded as ParsedFoodItem[];
}
