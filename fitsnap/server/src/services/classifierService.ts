/**
 * FitSnap Server - Classifier Microservice Connector
 * Connects to local FastAPI service running Custom ResNet & U-Net models.
 */

import { ML_SERVICE_URL } from '../config.js';

export interface ClassifierPrediction {
  class_name: string;
  confidence: number;
  display_name: string;
  fdc_id?: string;
  category?: string;
  per_100g?: any;
  default_portion?: any;
  portions?: any[];
}

export interface ClassifierResponse {
  success: boolean;
  top_prediction?: ClassifierPrediction;
  predictions: ClassifierPrediction[];
  segmentation?: any;
  quality_checks?: any;
  device?: string;
  model?: string;
}

export async function queryConvNeXtClassifier(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<ClassifierResponse | null> {
  const url = `${ML_SERVICE_URL}/predict`;
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
    formData.append('file', blob, mimeType.includes('png') ? 'meal.png' : 'meal.jpg');

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return (await res.json()) as ClassifierResponse;
    }
    return null;
  } catch (err: any) {
    console.warn('[ClassifierService] Python ML inference service offline:', err.message);
    return null;
  }
}
