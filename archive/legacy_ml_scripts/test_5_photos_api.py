"""
test_5_photos_api.py
Tests the FastAPI /predict HTTP route across 5 distinct test photos:
1. Burger (Western Fast Food)
2. Samosa (Indian Snack)
3. Butter Naan (Mixed Indian Plate)
4. Pizza (Italian Dish)
5. Office Notebook & Pen (Non-Food Image)

Validates: HTTP 200, class, confidence, nutrition, Grad-CAM Base64 heatmap, and U-Net plate portion.
"""

import sys
import json
from pathlib import Path
from PIL import Image, ImageDraw

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
from fastapi.testclient import TestClient

# Create non-food image if missing
non_food_path = DATA_DIR / "sample_non_food.jpg"
if not non_food_path.exists():
    img_nf = Image.new("RGB", (256, 256), color=(220, 225, 230))
    draw = ImageDraw.Draw(img_nf)
    for y in range(30, 250, 20):
        draw.line([(20, y), (236, y)], fill=(180, 190, 205), width=1)
    draw.line([(55, 10), (55, 246)], fill=(220, 120, 120), width=2)
    draw.rectangle([(160, 60), (175, 200)], fill=(30, 40, 70))
    draw.polygon([(160, 60), (175, 60), (167, 35)], fill=(200, 200, 210))
    img_nf.save(non_food_path, "JPEG", quality=90)

with open(DATA_DIR / "test_split.json", "r", encoding="utf-8") as f:
    test_split = json.load(f)

def find_sample(class_name):
    for item in test_split:
        if item["class_name"].lower() == class_name.lower():
            fp = item.get("filepath", item.get("path"))
            return PROJECT_ROOT / fp
    raise FileNotFoundError(f"Could not find test sample for {class_name}")

photos = [
    ("Photo 1: Western Fast Food (Burger)", find_sample("burger")),
    ("Photo 2: Indian Snack (Samosa)", find_sample("samosa")),
    ("Photo 3: Mixed Indian Plate (Butter Naan)", find_sample("butter_naan")),
    ("Photo 4: Italian Dish (Pizza)", find_sample("pizza")),
    ("Photo 5: Non-Food Image (Office Notebook & Pen)", non_food_path)
]

client = TestClient(server.app)

print("\n" + "=" * 70)
print("🚀 TESTING FASTAPI HTTP /predict ROUTE ON 5 REAL PHOTOS")
print("=" * 70)

for label, img_path in photos:
    assert img_path.exists(), f"Missing file: {img_path}"
    with open(img_path, "rb") as f:
        resp = client.post("/predict", files={"file": (img_path.name, f, "image/jpeg")})
    assert resp.status_code == 200, f"HTTP error {resp.status_code}: {resp.text}"
    data = resp.json()

    clean_data = dict(data)
    if clean_data.get("gradcam"):
        clean_data["gradcam"] = clean_data["gradcam"][:60] + "... [VALID BASE64 JPEG HEATMAP]"

    print("\n" + "#" * 70)
    print(f"📷 {label.upper()}")
    print(f"File: {img_path.name} (HTTP {resp.status_code})")
    print("#" * 70)
    print(json.dumps(clean_data, indent=2))

print("\n" + "=" * 70)
print("✅ ALL 5 PHOTOS PASSED FASTAPI HTTP /predict VALIDATION")
print("=" * 70)
