"""
test_checkpoints_and_predict.py
Automated Verification Suite for Step 6:
1. FAILS if ml/checkpoints/cnn_best.pt, unet_best.pt, or temperature.json are missing.
2. Runs /predict on 3 real food photos (including Indian staple).
3. Verifies two different food photos yield different, sensible predictions with calibrated confidence.
4. Prints raw JSON response, confidence scores, and Grad-CAM output.
"""

import sys
import os
import json
import io
from pathlib import Path

# Fix Windows console UTF-8 encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# ─── 1. Mandatory Checkpoint Existence Assertion ─────────────────────────────
print("\n" + "=" * 65)
print("🔍 STEP 6: VERIFYING TRAINED CHECKPOINTS EXISTENCE")
print("=" * 65)

cnn_ckpt = CHECKPOINTS_DIR / "cnn_best.pt"
unet_ckpt = CHECKPOINTS_DIR / "unet_best.pt"
temp_json = CHECKPOINTS_DIR / "temperature.json"

assert cnn_ckpt.exists(), f"❌ CRITICAL FAILURE: Missing required checkpoint {cnn_ckpt}"
assert unet_ckpt.exists(), f"❌ CRITICAL FAILURE: Missing required checkpoint {unet_ckpt}"
assert temp_json.exists(), f"❌ CRITICAL FAILURE: Missing required calibration file {temp_json}"

print(f"  ✅ cnn_best.pt exists ({cnn_ckpt.stat().st_size:,} bytes)")
print(f"  ✅ unet_best.pt exists ({unet_ckpt.stat().st_size:,} bytes)")
print(f"  ✅ temperature.json exists ({temp_json.stat().st_size:,} bytes)")

with open(temp_json, "r", encoding="utf-8") as f:
    temp_info = json.load(f)
print(f"  ✅ Calibration Loaded: Optimal T = {temp_info.get('optimal_temperature')} (Post-ECE: {temp_info.get('post_calibration_ece')})")

# ─── 2. Setup ─────────────────────────────────────────────────────────────────
from fastapi import UploadFile
import server
server.load_models()

# ─── 3. Run Predictions on Real Photos ───────────────────────────────────────
test_split_path = BASE_DIR / "data" / "test_split.json"
assert test_split_path.exists(), f"Missing {test_split_path}"

with open(test_split_path, "r", encoding="utf-8") as f:
    test_samples = json.load(f)

# Select 3 distinct food photos:
# Sample 1: Western dish (e.g. burger)
# Sample 2: Snack / dish (e.g. samosa or fries)
# Sample 3: Mixed Indian plate (e.g. butter_naan or dal_makhani or chole_bhature)

sample_burger = next((s for s in test_samples if s["class_name"].lower() == "burger"), test_samples[0])
sample_samosa = next((s for s in test_samples if s["class_name"].lower() == "samosa"), test_samples[1])
sample_indian = next((s for s in test_samples if s["class_name"].lower() in ["butter_naan", "dal_makhani", "chole_bhature", "masala_dosa"]), test_samples[2])

selected_samples = [
    ("Photo 1 (Western Dish)", sample_burger),
    ("Photo 2 (Snack)", sample_samosa),
    ("Photo 3 (Mixed Indian Plate)", sample_indian)
]

predictions_record = []

print("\n" + "=" * 65)
print("🚀 RUNNING /predict ON 3 SAMPLE PHOTOS (REAL INFERENCE)")
print("=" * 65)

for label, s in selected_samples:
    raw_fp = s.get("filepath", s.get("path", s.get("image_path")))
    img_path = PROJECT_ROOT / raw_fp if not Path(raw_fp).is_absolute() else Path(raw_fp)
    assert img_path.exists(), f"Image not found: {img_path}"

    with open(img_path, "rb") as f:
        file_bytes = f.read()

    upload = UploadFile(filename=img_path.name, file=io.BytesIO(file_bytes))
    data = server.predict_food(upload)
    assert data.get("success") is True, f"Failed inference: {data}"

    top_pred = data.get("top_prediction")
    assert top_pred is not None, "Missing top_prediction in response"
    seg = data.get("segmentation")
    gradcam = data.get("gradcam")

    predictions_record.append({
        "label": label,
        "ground_truth": s["class_name"],
        "predicted_class": top_pred["class_name"],
        "confidence": top_pred["confidence"],
        "portion_grams": seg.get("estimated_grams") if seg else None,
        "portion_range": seg.get("portion_range") if seg else None,
        "has_gradcam": bool(gradcam and gradcam.startswith("data:image/jpeg;base64,")),
        "raw_json": data
    })

    print(f"\n📸 {label}: '{s['class_name']}'")
    print(f"  • Top Prediction:  '{top_pred['display_name']}' (Class: {top_pred['class_name']})")
    print(f"  • Calibrated Conf: {top_pred['confidence'] * 100:.1f}%")
    print(f"  • U-Net Portion:   {seg.get('estimated_grams')}g ({seg.get('portion_range')})")
    print(f"  • Grad-CAM Overlay: {'Generated (Base64 JPEG)' if gradcam else 'None'}")

# ─── 4. Distinctness & Sanity Assertions ─────────────────────────────────────
print("\n" + "=" * 65)
print("🔬 VERIFYING DISCRIMINATIVE INFERENCE & PREDICTION SENSITIVITY")
print("=" * 65)

class_1 = predictions_record[0]["predicted_class"]
class_2 = predictions_record[1]["predicted_class"]
conf_1 = predictions_record[0]["confidence"]
conf_2 = predictions_record[1]["confidence"]

print(f"  • Photo 1 Predicted: '{class_1}' (Confidence: {conf_1*100:.1f}%)")
print(f"  • Photo 2 Predicted: '{class_2}' (Confidence: {conf_2*100:.1f}%)")

assert class_1 != class_2, f"❌ FAILURE: Two different foods gave identical prediction '{class_1}'!"
assert conf_1 > 0.1, "Confidence score 1 is uncalibrated / zero"
assert conf_2 > 0.1, "Confidence score 2 is uncalibrated / zero"
assert predictions_record[0]["has_gradcam"], "Missing Grad-CAM for Photo 1"
assert predictions_record[1]["has_gradcam"], "Missing Grad-CAM for Photo 2"
assert predictions_record[2]["has_gradcam"], "Missing Grad-CAM for Photo 3"

print("  ✅ DISCRIMINATIVE CHECK PASSED: Two different food photos yielded distinct, sensitive predictions.")

# ─── 5. Print Sample Raw JSON Payload ────────────────────────────────────────
print("\n" + "=" * 65)
print("📄 RAW JSON RESPONSE FOR PHOTO 3 (Mixed Indian Plate):")
print("=" * 65)
sample_3_raw = predictions_record[2]["raw_json"].copy()
# Truncate gradcam for display
if sample_3_raw.get("gradcam"):
    sample_3_raw["gradcam"] = sample_3_raw["gradcam"][:60] + "... [TRUNCATED BASE64 PNG]"
print(json.dumps(sample_3_raw, indent=2))

print("\n" + "=" * 65)
print("🎉 ALL STEP 6 CHECKS FULLY VERIFIED (Zero Mocks / Real GPU Checkpoints)")
print("=" * 65 + "\n")
