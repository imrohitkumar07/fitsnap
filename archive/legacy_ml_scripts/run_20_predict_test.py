"""
run_20_predict_test.py
Part 8 Verification:
Runs /predict on:
- 10 photos from held-out test split
- 10 photos from outside the dataset (./data/personal_test/)

Prints raw JSON for each: top-3, confidence, segmentation items, portion range, nutrition, Grad-CAM.
Calculates Top-1 and Top-3 accuracy.
"""

import sys
import os
import json
import io
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import server
from fastapi import UploadFile

# Ensure models loaded
server.load_models()

# Load test split
with open(DATA_DIR / "test_split.json", "r", encoding="utf-8") as f:
    test_split = json.load(f)

# 10 distinct classes from test split
test_classes = [
    "burger",
    "samosa",
    "pizza",
    "masala_dosa",
    "ramen_noodle",
    "butter_naan",
    "fried_rice",
    "french_fries",
    "chole_bhature",
    "dal_makhani"
]

test_10 = []
for tc in test_classes:
    for item in test_split:
        if item["class_name"].lower() == tc.lower():
            fp = PROJECT_ROOT / item.get("filepath", item.get("path"))
            if fp.exists():
                test_10.append({
                    "id": f"TEST_SPLIT_{tc.upper()}",
                    "class_name": tc,
                    "path": fp,
                    "is_outside": False
                })
                break

assert len(test_10) == 10, f"Expected 10 test samples, got {len(test_10)}"

# 10 outside samples
outside_dir = PROJECT_ROOT / "data" / "personal_test"
outside_files = [
    ("outside_01_apple_pie.jpg", "apple_pie"),
    ("outside_02_cheesecake.jpg", "cheesecake"),
    ("outside_03_chicken_curry.jpg", "chicken_curry"),
    ("outside_04_burger.jpg", "burger"),
    ("outside_05_butter_naan.jpg", "butter_naan"),
    ("outside_06_chole_bhature.jpg", "chole_bhature"),
    ("outside_07_chai.jpg", "chai"),
    ("outside_08_chapati.jpg", "chapati"),
    ("outside_09_user_upload_plate.png", "sandwich"), # User plate
    ("outside_10_non_food_office_notebook.jpg", "non_food") # Non-food control
]

outside_10 = []
for fn, label in outside_files:
    fp = outside_dir / fn
    assert fp.exists(), f"Missing outside file: {fp}"
    outside_10.append({
        "id": f"OUTSIDE_{label.upper()}",
        "class_name": label,
        "path": fp,
        "is_outside": True
    })

all_20 = test_10 + outside_10

print("=" * 80)
print("🚀 RUNNING /predict INFERENCE ON 20 PHOTOS (10 TEST SPLIT + 10 OUTSIDE DATASET)")
print("=" * 80)

results_record = []
test_top1 = 0
test_top3 = 0
outside_top1 = 0
outside_top3 = 0

for idx, sample in enumerate(all_20):
    p = sample["path"]
    expected = sample["class_name"]
    is_out = sample["is_outside"]

    with open(p, "rb") as f:
        file_bytes = f.read()

    upload = UploadFile(filename=p.name, file=io.BytesIO(file_bytes))
    resp = server.predict_food(upload)

    top_pred = resp.get("top_prediction")
    preds = resp.get("predictions", [])
    top3_classes = [pr["class_name"] for pr in preds[:3]] if preds else []
    top1_class = top_pred["class_name"] if top_pred else "None"

    is_correct_top1 = (top1_class.lower() == expected.lower())
    is_correct_top3 = any(expected.lower() in c.lower() for c in top3_classes)

    # For non-food image, "correct" means flagged as non-food!
    if expected == "non_food":
        is_correct_top1 = (resp.get("is_likely_food") is False)
        is_correct_top3 = (resp.get("is_likely_food") is False)

    if not is_out:
        if is_correct_top1: test_top1 += 1
        if is_correct_top3: test_top3 += 1
    else:
        if is_correct_top1: outside_top1 += 1
        if is_correct_top3: outside_top3 += 1

    clean_resp = dict(resp)
    # Truncate gradcam for printing
    if clean_resp.get("gradcam"):
        clean_resp["gradcam"] = clean_resp["gradcam"][:65] + "... [VALID BASE64 JPEG GRAD-CAM HEATMAP]"

    print("\n" + "#" * 80)
    tag = "OUTSIDE DATASET (./data/personal_test/)" if is_out else "HELD-OUT TEST SPLIT"
    print(f"[{idx+1:02d}/20] {tag} | Expected: '{expected}' | File: {p.name}")
    print("#" * 80)
    print(json.dumps(clean_resp, indent=2))
    print(f"-> Top-1 Match: {is_correct_top1} (Predicted: {top1_class})")
    print(f"-> Top-3 Matches: {top3_classes}")

print("\n" + "=" * 80)
print("📊 20-PHOTO PREDICTION ACCURACY SUMMARY")
print("=" * 80)
print(f"• Held-Out Test Split (10 Photos):")
print(f"   - Top-1 Correct: {test_top1} / 10 ({test_top1*10:.1f}%)")
print(f"   - Top-3 Correct: {test_top3} / 10 ({test_top3*10:.1f}%)")
print(f"\n• Outside Dataset (./data/personal_test/, 10 Photos):")
print(f"   - Top-1 Correct: {outside_top1} / 10 ({outside_top1*10:.1f}%)")
print(f"   - Top-3 Correct: {outside_top3} / 10 ({outside_top3*10:.1f}%)")
print(f"\n• Overall Combined (20 Photos):")
print(f"   - Top-1 Correct: {test_top1 + outside_top1} / 20 ({(test_top1 + outside_top1)*5:.1f}%)")
print(f"   - Top-3 Correct: {test_top3 + outside_top3} / 20 ({(test_top3 + outside_top3)*5:.1f}%)")
print("=" * 80)
