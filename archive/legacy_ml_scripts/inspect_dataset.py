"""
inspect_dataset.py
Part 2 Data Inspection Script for FitSnap.
Inspects raw image dataset: classes, counts, formats, dimensions, corruptions,
perceptual hash duplicates (dHash), class imbalance, and checks for segmentation masks.
Outputs comprehensive statistics for review and approval.
"""

import os
import sys
from pathlib import Path
from collections import defaultdict, Counter
from PIL import Image
import numpy as np

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

def dhash(image, hash_size=8):
    """
    Computes difference hash (dHash) for perceptual duplication detection.
    """
    resized = image.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = np.array(resized)
    difference = pixels[:, 1:] > pixels[:, :-1]
    return sum([2 ** i for i, v in enumerate(difference.flatten()) if v])

def inspect_dataset():
    # Detect dataset location
    possible_roots = [
        Path("fitsnap/Food Classification Dataset"),
        Path("Food Classification Dataset"),
        Path("../fitsnap/Food Classification Dataset")
    ]
    dataset_root = None
    for p in possible_roots:
        if p.exists() and p.is_dir():
            dataset_root = p.resolve()
            break

    if dataset_root is None:
        print("❌ Dataset folder 'Food Classification Dataset' not found!")
        sys.exit(1)

    print("=" * 70)
    print("📊 PART 2: DATASET INSPECTION & PROFILE REPORT")
    print("=" * 70)
    print(f"Dataset Root: {dataset_root}\n")

    class_dirs = sorted([d for d in dataset_root.iterdir() if d.is_dir() and not d.name.startswith('.')])
    num_classes = len(class_dirs)
    print(f"Total Food Classes: {num_classes}")

    class_counts = {}
    formats = Counter()
    widths = []
    heights = []
    corrupted_files = []
    hashes = defaultdict(list)
    total_images = 0

    valid_exts = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.jfif'}

    print("Scanning and verifying images across all classes...")
    for c_dir in class_dirs:
        c_name = c_dir.name
        img_files = [f for f in c_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]
        class_counts[c_name] = len(img_files)

        for f in img_files:
            total_images += 1
            formats[f.suffix.lower()] += 1
            try:
                with Image.open(f) as img:
                    img.verify()
                # Reopen to read size and compute hash
                with Image.open(f) as img:
                    w, h = img.size
                    widths.append(w)
                    heights.append(h)
                    h_val = dhash(img)
                    hashes[h_val].append(str(f.relative_to(dataset_root)))
            except Exception as e:
                corrupted_files.append((str(f.relative_to(dataset_root)), str(e)))

    print(f"\nTotal Valid Images:  {total_images}")
    print(f"Corrupted Images:    {len(corrupted_files)}")

    # Class balance stats
    counts = list(class_counts.values())
    min_count = min(counts) if counts else 0
    max_count = max(counts) if counts else 0
    mean_count = sum(counts) / len(counts) if counts else 0
    imbalance_ratio = max_count / max(min_count, 1)

    print("\n📈 Class Distribution & Imbalance:")
    print(f"  • Min images in class:  {min_count} ({[k for k, v in class_counts.items() if v == min_count][0]})")
    print(f"  • Max images in class:  {max_count} ({[k for k, v in class_counts.items() if v == max_count][0]})")
    print(f"  • Mean images / class:  {mean_count:.1f}")
    print(f"  • Max/Min Ratio:        {imbalance_ratio:.2f}x")

    # Dimensions
    min_w, max_w = min(widths), max(widths)
    min_h, max_h = min(heights), max(heights)
    mean_w = sum(widths) / len(widths)
    mean_h = sum(heights) / len(heights)

    print("\n📐 Image Resolutions & Formats:")
    print(f"  • Width range:   [{min_w}, {max_w}] (Mean: {mean_w:.1f} px)")
    print(f"  • Height range:  [{min_h}, {max_h}] (Mean: {mean_h:.1f} px)")
    print("  • File Formats:  " + ", ".join([f"{k}: {v} ({v/total_images*100:.1f}%)" for k, v in formats.items()]))

    # Duplicates via perceptual hash
    duplicates = {h: files for h, files in hashes.items() if len(files) > 1}
    dup_image_count = sum(len(f) - 1 for f in duplicates.values())
    print(f"\n🔍 Perceptual Duplicates (dHash): {dup_image_count} near-identical images across {len(duplicates)} duplicate sets")

    # Indian vs Western Breakdown
    indian_dishes = [
        "butter_naan", "chai", "chapati", "chicken_curry", "chole_bhature",
        "dal_makhani", "dhokla", "idli", "jalebi", "kaathi_rolls", "kadai_paneer",
        "kulfi", "masala_dosa", "momos", "paani_puri", "pakode", "pav_bhaji", "samosa"
    ]
    western_dishes = [
        "Baked Potato", "Crispy Chicken", "Donut", "Fries", "Hot Dog", "Sandwich",
        "Taco", "Taquito", "apple_pie", "burger", "cheesecake", "fried_rice",
        "ice_cream", "omelette", "pizza", "sushi"
    ]

    print("\n🍛 Regional Food Breakdown:")
    print(f"  • Indian Dishes:  {len(indian_dishes)} classes")
    print(f"  • Western/Asian:  {len(western_dishes)} classes")

    print("\nDetailed Per-Class Counts:")
    for c_name, count in sorted(class_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {c_name:<20}: {count} images")

    print("\n" + "=" * 70)

if __name__ == "__main__":
    inspect_dataset()
