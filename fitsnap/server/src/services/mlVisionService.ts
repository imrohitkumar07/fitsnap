/**
 * FitSnap Server - Local ML Vision Service
 * Communicates with the local PyTorch microservice (Custom ResNet CNN + U-Net Segmenter).
 * Strictly 100% Offline (Zero LLM / Zero Cloud AI).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { ML_SERVICE_URL } from '../config.js';
import type { FoodItem, MLVisionResponse } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatMLResult(mlResult: MLInferenceResult): { vision: MLVisionResponse; mlRaw?: MLInferenceResult } {
  if (!mlResult || !mlResult.success) {
    throw new Error(`ML Service returned invalid response format: ${JSON.stringify(mlResult)}`);
  }
  const top = mlResult.top_prediction;
  const seg = mlResult.segmentation;
  const isUnknown = mlResult.recognition_state === 'unknown';
  const isNotSure = mlResult.recognition_state === 'not_sure';

  // Rough visual portion estimation for unknown foods
  const cov = seg?.coverage_ratio || 0.35;
  let roughSize = 'Medium';
  let roughGrams = 180;
  let roughRange = '150g - 210g';
  if (cov < 0.25) {
    roughSize = 'Small';
    roughGrams = 120;
    roughRange = '100g - 140g';
  } else if (cov > 0.50) {
    roughSize = 'Large';
    roughGrams = 300;
    roughRange = '250g - 350g';
  }

  const portionG = isUnknown ? roughGrams : (seg?.estimated_grams || top?.default_portion?.gramWeight || 150);
  const portionLabel = isUnknown
    ? `Visual estimate: ${roughRange} (${roughSize})`
    : (seg?.portion_range ? `Plate estimate: ${seg.portion_range}` : (top?.default_portion?.description || '1 serving'));

  const per100g = top?.per_100g || {
    calories_kcal: 180,
    protein_g: 8,
    carbs_g: 22,
    fat_g: 6,
    fiber_g: 2,
  };

  const factor = portionG / 100.0;
  const cal = isUnknown ? 0 : Math.round((Number(per100g.calories_kcal) || 180) * factor);

  const foodItem: any = {
    name: isUnknown ? 'Food Not Recognised' : (top?.display_name || 'Food Item'),
    portionG,
    portionLabel,
    calories: cal,
    proteinG: isUnknown ? 0 : parseFloat(((Number(per100g.protein_g) || 8) * factor).toFixed(1)),
    carbsG: isUnknown ? 0 : parseFloat(((Number(per100g.carbs_g) || 22) * factor).toFixed(1)),
    fatG: isUnknown ? 0 : parseFloat(((Number(per100g.fat_g) || 6) * factor).toFixed(1)),
    fiberG: isUnknown ? 0 : parseFloat(((Number(per100g.fiber_g) || 2) * factor).toFixed(1)),
    sugarG: isUnknown ? 0 : 2,
    sodiumMg: isUnknown ? 0 : 350,
    confidence: mlResult.calibrated_confidence !== undefined ? mlResult.calibrated_confidence : (top?.confidence || 0.5),
    isAiEstimate: isUnknown || isNotSure,
    isUnknown,
    recognitionState: mlResult.recognition_state || (top && top.confidence >= 0.60 ? 'recognised' : 'not_sure'),
    stateMessage: mlResult.state_message || (isUnknown ? "I couldn't recognise this food. Please search or pick below." : 'Food analysed.'),
    roughVisualSize: roughSize,
    entropy: mlResult.entropy,
    prototypeDistance: mlResult.prototype_distance,
    closestPrototypeClass: mlResult.closest_prototype_class,
    embedding: mlResult.embedding,
    badge: isUnknown ? 'AI estimate' : (top && top.confidence >= 0.70 ? 'Verified from database' : 'AI estimate'),
    source: isUnknown ? 'Awaiting Food Selection' : (top ? 'USDA / Reference DB' : 'Visual ML'),
    portions: isUnknown
      ? [
          { description: `Small portion (120g)`, gramWeight: 120 },
          { description: `Medium portion (180g)`, gramWeight: 180 },
          { description: `Large portion (300g)`, gramWeight: 300 },
          { description: `100g`, gramWeight: 100 },
        ]
      : (top?.portions || [{ description: '1 serving', gramWeight: portionG }]),
  };

  return {
    vision: { foods: [foodItem] },
    mlRaw: mlResult,
  };
}

export interface MLInferenceResult {
  success: boolean;
  recognition_state?: 'recognised' | 'not_sure' | 'unknown';
  state_message?: string;
  calibrated_confidence?: number;
  entropy?: number;
  prototype_distance?: number;
  closest_prototype_class?: string | null;
  embedding?: number[];
  quality_checks?: {
    is_blurry: boolean;
    is_dark: boolean;
    is_overexposed: boolean;
    entropy: number;
    laplacian_var: number;
  };
  top_prediction?: {
    class_name: string;
    confidence: number;
    display_name: string;
    fdc_id?: string;
    category?: string;
    per_100g?: any;
    default_portion?: any;
    portions?: any[];
  };
  predictions?: Array<{
    class_name: string;
    confidence: number;
    display_name: string;
    fdc_id?: string;
    category?: string;
    per_100g?: any;
    default_portion?: any;
    portions?: any[];
  }>;
  segmentation?: {
    coverage_ratio: number;
    estimated_grams: number;
    portion_range: string;
    plate_detected: boolean;
    is_weak_mask_supervised: boolean;
  };
  is_likely_food?: boolean;
  non_food_warning?: string | null;
  device?: string;
  model?: string;
}

/**
 * Analyzes food image using local Custom ResNet classifier and U-Net plate segmenter.
 */
export async function analyzeFoodImageWithML(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<{ vision: MLVisionResponse; mlRaw?: MLInferenceResult }> {
  const url = `${ML_SERVICE_URL}/predict`;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
    formData.append('file', blob, mimeType.includes('png') ? 'meal.png' : 'meal.jpg');

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (res.ok) {
      const mlResult = (await res.json()) as MLInferenceResult;
      return formatMLResult(mlResult);
    } else {
      throw new Error(`ML Service HTTP error ${res.status}: ${await res.text()}`);
    }
  } catch (err: any) {
    // Graceful direct local IPC invocation via predict_cli.py
    try {
      const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
      const pythonBin = path.resolve(PROJECT_ROOT, 'ml/.venv/Scripts/python.exe');
      const cliScript = path.resolve(PROJECT_ROOT, 'ml/predict_cli.py');
      const tempPath = path.resolve(os.tmpdir(), `fitsnap_scan_${Date.now()}.jpg`);
      fs.writeFileSync(tempPath, imageBuffer);

      const out = execSync(`"${pythonBin}" "${cliScript}" "${tempPath}"`, {
        cwd: path.resolve(PROJECT_ROOT, 'ml'),
        maxBuffer: 25 * 1024 * 1024,
      }).toString();

      try { fs.unlinkSync(tempPath); } catch {}

      const jsonStart = out.lastIndexOf('{"success":');
      if (jsonStart !== -1) {
        const mlResult = JSON.parse(out.substring(jsonStart).trim()) as MLInferenceResult;
        return formatMLResult(mlResult);
      }
    } catch (ipcErr: any) {
      console.error('[MLVisionService] Local ML IPC error:', ipcErr.message);
      throw new Error(`Local ML Service Error: Real checkpoints required on GPU. Details: ${ipcErr.message}`);
    }
    throw new Error(`Local ML Service Error: Real checkpoints required on GPU. Details: ${err.message}`);
  }
}
