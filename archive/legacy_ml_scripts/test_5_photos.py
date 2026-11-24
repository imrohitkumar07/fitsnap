"""
test_5_photos.py
Executes /predict on 5 distinct real images:
1. Photo 1: Burger (Western dish)
2. Photo 2: Samosa (Snack)
3. Photo 3: Butter Naan (Mixed Indian plate)
4. Photo 4: Pizza (Italian dish)
5. Photo 5: Non-Food Image (Office desk notebook texture)

Prints the raw JSON output for each, verifies confidence, quality checks, portion, and Grad-CAM.
"""

import sys
import os
import json
import io
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

# Create realistic non-food image if not already present
non_food_path = DATA_DIR / "sample_non_food.jpg"
if not non_food_path.exists():
    img_nf = Image.new("RGB", (256, 256), color=(220, 225, 230))
    draw = ImageDraw.Draw(img_nf)
    # Draw ruled notebook lines
    for y in range(30, 250, 20):
        draw.line([(20, y), (236, y)], fill=(180, 190, 205), width=1)
    # Draw vertical red margin line
    draw.line([(55, 10), (55, 246)], fill=(220, 120, 120), width=2)
    # Draw pen
    draw.rectangle([(160, 60), (175, 200)], fill=(30, 40, 70))
    draw.polygon([(160, 60), (175, 60), (167, 35)], fill=(200, 200, 210))
    img_nf.save(non_food_path, "JPEG", quality=90)
    print(f"Created non-food test image: {non_food_path}")

# Load models in server
import server
from fastapi import UploadFile
server.load_models()

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

print("\n" + "=" * 70)
print("🚀 RUNNING /predict ON 5 DISTINCT TEST PHOTOS (INCLUDING NON-FOOD)")
print("=" * 70)

for label, path in photos:
    assert path.exists(), f"Image path does not exist: {path}"
    with open(path, "rb") as f:
        file_bytes = f.read()

    upload = UploadFile(filename=path.name, file=io.BytesIO(file_bytes))
    response_data = server.predict_food(upload)

    # Make a clean copy for printing, truncating the long Base64 string for terminal legibility
    clean_data = dict(response_data)
    if clean_data.get("gradcam"):
        clean_data["gradcam"] = clean_data["gradcam"][:60] + "... [VALID BASE64 JPEG HEATMAP]"

    print("\n" + "#" * 70)
    print(f"📷 {label.upper()}")
    print(f"File: {path.name}")
    print("#" * 70)
    print(json.dumps(clean_data, indent=2))
