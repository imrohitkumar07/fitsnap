import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR.parent / "fitsnap" / "Food Classification Dataset"

CLASSES = [
    "Baked Potato", "Crispy Chicken", "Donut", "Fries", "Hot Dog",
    "Sandwich", "Taco", "Taquito", "apple_pie", "burger", "butter_naan",
    "chai", "chapati", "cheesecake", "chicken_curry", "chole_bhature",
    "dal_makhani", "dhokla", "fried_rice", "ice_cream", "idli", "jalebi",
    "kaathi_rolls", "kadai_paneer", "kulfi", "masala_dosa", "momos",
    "omelette", "paani_puri", "pakode", "pav_bhaji", "pizza", "samosa", "sushi"
]

def generate_samples(samples_per_class=10):
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Generating {samples_per_class} synthetic images for each of {len(CLASSES)} classes in {DATASET_DIR}...")
    
    for c_idx, class_name in enumerate(CLASSES):
        class_folder = DATASET_DIR / class_name
        class_folder.mkdir(parents=True, exist_ok=True)
        
        # Consistent color palette per class based on hash
        rng = np.random.default_rng(c_idx + 42)
        base_color = rng.integers(50, 220, size=3)
        
        for i in range(samples_per_class):
            img_path = class_folder / f"{class_name}_{i+1:03d}.jpg"
            if img_path.exists():
                continue
                
            # Create a 256x256 image with class-specific color variation and geometric shapes
            img_arr = np.ones((256, 256, 3), dtype=np.uint8) * base_color
            noise = rng.integers(-25, 25, size=(256, 256, 3))
            img_arr = np.clip(img_arr.astype(np.int32) + noise, 0, 255).astype(np.uint8)
            
            img = Image.fromarray(img_arr)
            draw = ImageDraw.Draw(img)
            
            # Draw distinctive patterns (circles, rectangles, lines)
            cx, cy = 128 + rng.integers(-30, 30), 128 + rng.integers(-30, 30)
            r = 50 + rng.integers(-10, 20)
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(rng.integers(100, 255, size=3)))
            
            # Add text label
            draw.text((15, 15), f"{class_name} #{i+1}", fill=(255, 255, 255))
            
            img.save(img_path, format="JPEG", quality=90)
            
    print("Done! Synthetic samples generated successfully.")

if __name__ == "__main__":
    generate_samples(10)
