"""
prepare_data.py
Part 2 Data Preparation Script for FitSnap.
1. Generates stratified 80/10/10 split with seed 42 and strict cross-split leakage check.
2. Pre-resizes images into offline caches (128px, 176px, 224px) for progressive training.
3. Generates weak pseudo-masks with classical OpenCV (Hough circle plate detection + GrabCut foreground extraction)
   saved to data/processed/seg/ and labeled as 'trained on weak masks'.
"""

import os
import sys
import json
import random
from pathlib import Path
from collections import defaultdict
import cv2
import numpy as np
from PIL import Image

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATASET_ROOT = PROJECT_ROOT / "fitsnap" / "Food Classification Dataset"
if not DATASET_ROOT.exists():
    DATASET_ROOT = PROJECT_ROOT / "Food Classification Dataset"

DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
SEG_DIR = PROJECT_ROOT / "data" / "processed" / "seg"

DATA_DIR.mkdir(parents=True, exist_ok=True)
SEG_DIR.mkdir(parents=True, exist_ok=True)
(SEG_DIR / "images").mkdir(parents=True, exist_ok=True)
(SEG_DIR / "masks").mkdir(parents=True, exist_ok=True)

def dhash(image, hash_size=8):
    resized = image.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = np.array(resized)
    diff = pixels[:, 1:] > pixels[:, :-1]
    return sum([2 ** i for i, v in enumerate(diff.flatten()) if v])

def step1_stratified_split():
    print("\n--- 1. Generating Stratified 80/10/10 Split (Seed 42) ---")
    class_dirs = sorted([d for d in DATASET_ROOT.iterdir() if d.is_dir() and not d.name.startswith('.')])
    classes = [d.name for d in class_dirs]
    class_to_idx = {c: i for i, c in enumerate(classes)}

    train_samples = []
    val_samples = []
    test_samples = []

    train_hashes = set()
    val_hashes = set()
    test_hashes = set()

    for c in classes:
        c_dir = DATASET_ROOT / c
        files = sorted([f for f in c_dir.iterdir() if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png'}])
        
        # Shuffle deterministically per class with seed 42
        rng = random.Random(SEED + class_to_idx[c])
        shuffled = list(files)
        rng.shuffle(shuffled)

        n = len(shuffled)
        n_train = int(round(n * 0.8)) # 8 for 10
        n_val = int(round(n * 0.1))   # 1 for 10
        n_test = n - n_train - n_val  # 1 for 10

        c_train = shuffled[:n_train]
        c_val = shuffled[n_train:n_train + n_val]
        c_test = shuffled[n_train + n_val:]

        for f in c_train:
            rel = str(f.relative_to(PROJECT_ROOT)).replace('\\', '/')
            train_samples.append({"path": rel, "class_name": c, "label": class_to_idx[c]})
            with Image.open(f) as img:
                train_hashes.add(dhash(img))

        for f in c_val:
            rel = str(f.relative_to(PROJECT_ROOT)).replace('\\', '/')
            val_samples.append({"path": rel, "class_name": c, "label": class_to_idx[c]})
            with Image.open(f) as img:
                val_hashes.add(dhash(img))

        for f in c_test:
            rel = str(f.relative_to(PROJECT_ROOT)).replace('\\', '/')
            test_samples.append({"path": rel, "class_name": c, "label": class_to_idx[c]})
            with Image.open(f) as img:
                test_hashes.add(dhash(img))

    # Cross-split leakage check (both exact file and near-duplicate dHash)
    train_paths = {s["path"] for s in train_samples}
    val_paths = {s["path"] for s in val_samples}
    test_paths = {s["path"] for s in test_samples}

    assert len(train_paths & val_paths) == 0, "Leakage detected: train and val overlap!"
    assert len(train_paths & test_paths) == 0, "Leakage detected: train and test overlap!"
    assert len(val_paths & test_paths) == 0, "Leakage detected: val and test overlap!"

    hash_leakage = (train_hashes & val_hashes) | (train_hashes & test_hashes) | (val_hashes & test_hashes)
    assert len(hash_leakage) == 0, f"Perceptual hash leakage detected across splits: {len(hash_leakage)} duplicate hashes"

    print(f"  • Train: {len(train_samples)} images ({len(classes)} classes, {n_train}/class)")
    print(f"  • Val:   {len(val_samples)} images ({len(classes)} classes, {n_val}/class)")
    print(f"  • Test:  {len(test_samples)} images ({len(classes)} classes, {n_test}/class)")
    print("  • Leakage Check: Passed with 0 overlapping files and 0 duplicate perceptual hashes.")

    # Save split JSONs
    with open(DATA_DIR / "train_split.json", "w", encoding="utf-8") as f:
        json.dump(train_samples, f, indent=2)
    with open(DATA_DIR / "val_split.json", "w", encoding="utf-8") as f:
        json.dump(val_samples, f, indent=2)
    with open(DATA_DIR / "test_split.json", "w", encoding="utf-8") as f:
        json.dump(test_samples, f, indent=2)

    with open(DATA_DIR / "classes.json", "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2)

    return train_samples, val_samples, test_samples, classes

def step2_pre_resize_cache(all_samples, sizes=[128, 176, 224]):
    print(f"\n--- 2. Generating Offline Progressive Resizing Caches ({sizes}) ---")
    for sz in sizes:
        sz_dir = CACHE_DIR / str(sz)
        sz_dir.mkdir(parents=True, exist_ok=True)
        print(f"  • Creating {sz}x{sz} cache at {sz_dir}...")

        for s in all_samples:
            src_path = PROJECT_ROOT / s["path"]
            dst_dir = sz_dir / s["class_name"]
            dst_dir.mkdir(parents=True, exist_ok=True)
            dst_path = dst_dir / src_path.name

            if not dst_path.exists():
                with Image.open(src_path) as img:
                    img = img.convert("RGB")
                    img_resized = img.resize((sz, sz), Image.Resampling.BICUBIC)
                    img_resized.save(dst_path, "JPEG", quality=95)

    print("  • Progressive resize caches successfully generated.")

def generate_classical_pseudo_mask(img_bgr):
    """
    Classical OpenCV pseudo-mask generator:
    1. Detects circular plate boundary using GaussianBlur + HoughCircles.
    2. Runs GrabCut on the interior plate bounding box to extract food from plate surface.
    Returns: binary mask (0 = background/plate, 255 = food foreground).
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    # 1. Circle detection for plate rim
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=h // 2,
        param1=50,
        param2=30,
        minRadius=int(h * 0.25),
        maxRadius=int(h * 0.48)
    )

    plate_mask = np.zeros((h, w), dtype=np.uint8)
    if circles is not None:
        circles = np.uint16(np.around(circles))
        c = circles[0][0]
        cv2.circle(plate_mask, (c[0], c[1]), int(c[2] * 0.92), 255, -1)
        rect = (max(5, c[0] - c[2]), max(5, c[1] - c[2]), min(w - 10, c[2] * 2), min(h - 10, c[2] * 2))
    else:
        # Default central plate assumption
        center = (w // 2, h // 2)
        cv2.ellipse(plate_mask, center, (int(w * 0.42), int(h * 0.42)), 0, 0, 360, 255, -1)
        rect = (int(w * 0.1), int(h * 0.1), int(w * 0.8), int(h * 0.8))

    # 2. GrabCut Foreground Extraction
    mask_gc = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(img_bgr, mask_gc, rect, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_RECT)
        # GC_FGD (1) and GC_PR_FGD (3) are foreground
        food_fg = np.where((mask_gc == 1) | (mask_gc == 3), 255, 0).astype('uint8')
        # Restrict food foreground strictly inside plate region
        food_mask = cv2.bitwise_and(food_fg, plate_mask)
        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        food_mask = cv2.morphologyEx(food_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        food_mask = cv2.morphologyEx(food_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    except Exception:
        food_mask = plate_mask

    # If GrabCut selected almost nothing, fallback to threshold on saturation/contrast inside plate
    if np.sum(food_mask > 0) < (h * w * 0.05):
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        s_channel = hsv[:, :, 1]
        _, thresh = cv2.threshold(s_channel, 40, 255, cv2.THRESH_BINARY)
        food_mask = cv2.bitwise_and(thresh, plate_mask)

    return food_mask

def step3_generate_weak_pseudo_masks(all_samples):
    print("\n--- 3. Generating Weak Classical OpenCV Pseudo-Masks (GrabCut + Hough Circles) ---")
    meta = {
        "weak_pseudo_masks": True,
        "label": "trained on weak masks",
        "technique": "OpenCV HoughCircle plate detection + GrabCut foreground extraction",
        "disclaimer": "Pseudo-masks generated by classical heuristics; segmentation accuracy reflects weak supervision.",
        "samples": []
    }

    count = 0
    for s in all_samples:
        src_path = PROJECT_ROOT / s["path"]
        img_bgr = cv2.imread(str(src_path))
        if img_bgr is None:
            continue

        mask = generate_classical_pseudo_mask(img_bgr)
        
        base_name = f"{s['class_name']}_{src_path.stem}.png"
        img_save_path = SEG_DIR / "images" / base_name
        mask_save_path = SEG_DIR / "masks" / base_name

        cv2.imwrite(str(img_save_path), img_bgr)
        cv2.imwrite(str(mask_save_path), mask)

        meta["samples"].append({
            "image": f"images/{base_name}",
            "mask": f"masks/{base_name}",
            "class_name": s["class_name"],
            "label": s["label"],
            "foreground_ratio": float(np.sum(mask > 0) / (mask.shape[0] * mask.shape[1]))
        })
        count += 1

    with open(SEG_DIR / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"  • Generated {count} weak pseudo-masks in {SEG_DIR}")
    print("  • Saved weak mask metadata manifest (labeled 'trained on weak masks').")

def main():
    train_s, val_s, test_s, classes = step1_stratified_split()
    all_samples = train_s + val_s + test_s
    step2_pre_resize_cache(all_samples, sizes=[128, 176, 224])
    step3_generate_weak_pseudo_masks(all_samples)
    print("\n" + "=" * 65)
    print("✅ PART 2 PREPARATION FULLY COMPLETE & VERIFIED")
    print("=" * 65)

if __name__ == "__main__":
    main()
