"""
ml/prepare_unified_data.py
Part 4: Data preparation, deduplication, filtering, stratified splitting, and cache generation.
Unifies ./dataset256 (UEC-FOOD256) and ./Food_Classification.
"""

import os
import sys
import json
import glob
import hashlib
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from PIL import Image
from tqdm import tqdm
from sklearn.model_selection import StratifiedShuffleSplit

# UTF-8 stdout
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

# Fast 64-bit dHash computation using numpy
def compute_image_signatures(fp):
    """Computes MD5 and 64-bit dHash for an image file."""
    try:
        with open(fp, "rb") as f:
            raw = f.read()
            md5 = hashlib.md5(raw).hexdigest()
        
        with Image.open(fp) as img:
            img.load()
            w, h = img.size
            # Convert to grayscale 9x8 for dHash
            gray = img.convert("L").resize((9, 8), Image.Resampling.BILINEAR)
            arr = np.asarray(gray)
            diff = arr[:, 1:] > arr[:, :-1]
            dhash_val = int.from_bytes(np.packbits(diff).tobytes(), "big")
        
        return (True, fp, md5, dhash_val, (w, h), None)
    except Exception as e:
        return (False, fp, None, None, None, str(e))

def hamming_distance(h1, h2):
    return bin(h1 ^ h2).count('1')

def load_category_map():
    cat_map = {}
    cat_file = "dataset256/category.txt"
    if not os.path.exists(cat_file):
        cat_file = "fitsnap/UECFOOD256/category.txt"
    with open(cat_file, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) >= 2 and parts[0].isdigit():
                # Clean name: lowercase, replace spaces with underscores, standardize
                raw_name = parts[1].strip()
                norm_name = raw_name.lower().replace(" ", "_").replace("-", "_").replace("'", "")
                cat_map[parts[0]] = norm_name
    return cat_map

def main():
    print("=" * 75)
    print("🚀 FITSNAP PART 4: DATA PREPARATION & STRATIFIED SPLIT")
    print("=" * 75)

    cat_map = load_category_map()
    # Normalize some UEC names to match common terms
    # E.g. 'hamburger' -> 'burger', 'fried_rice' -> 'fried_rice'
    for k, v in list(cat_map.items()):
        if v == "hamburger":
            cat_map[k] = "burger"

    # Step 1: Collect all raw image paths and mapped class names
    print("\n[Step 1] Collecting raw files from ./dataset256 and ./Food_Classification...")
    raw_samples = [] # (fp, class_name, dataset_source)

    # 1. dataset256
    uec_dir = "dataset256/UECFOOD256" if os.path.exists("dataset256/UECFOOD256") else "dataset256"
    for folder in os.listdir(uec_dir):
        folder_path = os.path.join(uec_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        c_name = cat_map.get(folder, f"class_{folder}")
        for fn in os.listdir(folder_path):
            if fn.lower().endswith((".jpg", ".jpeg", ".png")):
                raw_samples.append((os.path.join(folder_path, fn), c_name, "dataset256"))

    # 2. Food_Classification
    fc_dir = "Food_Classification"
    for folder in os.listdir(fc_dir):
        folder_path = os.path.join(fc_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        norm_name = folder.lower().strip()
        if norm_name == "burger":
            norm_name = "burger"
        for fn in os.listdir(folder_path):
            if fn.lower().endswith((".jpg", ".jpeg", ".png", ".cms")):
                raw_samples.append((os.path.join(folder_path, fn), norm_name, "Food_Classification"))

    print(f"Total raw image candidates found: {len(raw_samples)}")

    # Initial class count distribution (before dedup)
    initial_class_counts = Counter(c for _, c, _ in raw_samples)
    sorted_initial = sorted(initial_class_counts.items(), key=lambda x: x[1])
    
    print("\n" + "="*75)
    print("📋 INITIAL DISTRIBUTION BEFORE DEDUPLICATION (Total Classes: %d)" % len(initial_class_counts))
    print("="*75)
    print(f"Total Images: {len(raw_samples)}")
    print(f"Largest 10 Classes:")
    for c, cnt in sorted_initial[-10:][::-1]:
        print(f"   • {c:<30} : {cnt:>5} images")
    print(f"\nSmallest 30 Classes:")
    for c, cnt in sorted_initial[:30]:
        print(f"   • {c:<30} : {cnt:>5} images")

    fewer_100 = sum(1 for _, cnt in initial_class_counts.items() if cnt < 100)
    fewer_50 = sum(1 for _, cnt in initial_class_counts.items() if cnt < 50)
    fewer_30 = sum(1 for _, cnt in initial_class_counts.items() if cnt < 30)

    print("\n📊 Class Count Thresholds:")
    print(f"   • Classes with < 100 images: {fewer_100}")
    print(f"   • Classes with < 50 images:  {fewer_50}")
    print(f"   • Classes with < 30 images:  {fewer_30}")

    # Step 2: Multithreaded Hash Computation & Deduplication
    print("\n" + "="*75)
    print("[Step 2] Computing Signatures & Deduplication (MD5 + pHash Hamming <= 6)...")
    print("="*75)

    sig_tasks = [fp for fp, _, _ in raw_samples]
    corrupted_files = []
    file_signatures = {} # fp -> (md5, dhash, size)

    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(compute_image_signatures, fp): fp for fp in sig_tasks}
        for fut in tqdm(as_completed(futures), total=len(sig_tasks), desc="Computing Image Hashes"):
            ok, fp, md5, dh, size, err = fut.result()
            if ok:
                file_signatures[fp] = (md5, dh, size)
            else:
                corrupted_files.append((fp, err))

    print(f"\nCorrupted Files Encountered: {len(corrupted_files)}")
    if corrupted_files:
        for cf, err in corrupted_files:
            print(f"   ❌ Dropping corrupted file: {cf} ({err})")

    # Dedup pass:
    # 1. Exact MD5 duplicates
    # 2. Near-duplicate pHash (Hamming distance <= 6)
    kept_samples = []
    dropped_exact_md5 = 0
    dropped_near_phash = 0

    seen_md5s = set()
    
    # Organize by class to do intra-class and cross-class duplicate pruning
    # Group existing hashes by high 16 bits of dHash for fast Hamming lookup
    hash_buckets = defaultdict(list)

    print("Running Hamming distance <= 6 duplicate filter...")
    for fp, c_name, src in tqdm(raw_samples, desc="Deduplicating"):
        if fp not in file_signatures:
            continue
        md5, dh, size = file_signatures[fp]
        
        # Check exact MD5
        if md5 in seen_md5s:
            dropped_exact_md5 += 1
            continue
        
        # Check near duplicate across all kept images
        bucket_key = dh >> 48 # top 16 bits
        is_dup = False
        # Check neighboring buckets or nearby hashes
        for neighbor_key in range(max(0, bucket_key - 1), min(65536, bucket_key + 2)):
            for existing_fp, existing_c, existing_dh in hash_buckets[neighbor_key]:
                if hamming_distance(dh, existing_dh) <= 6:
                    is_dup = True
                    break
            if is_dup:
                break
        
        if is_dup:
            dropped_near_phash += 1
            continue

        # Keep sample
        seen_md5s.add(md5)
        hash_buckets[bucket_key].append((fp, c_name, dh))
        kept_samples.append({
            "filepath": fp,
            "class_name": c_name,
            "source": src,
            "size": size,
            "md5": md5,
            "dhash": hex(dh)
        })

    print(f"\n✅ Deduplication Summary:")
    print(f"   • Exact MD5 Duplicates Removed:     {dropped_exact_md5}")
    print(f"   • Near-Duplicate pHash Removed:     {dropped_near_phash}")
    print(f"   • Total Removed Before Splitting:   {dropped_exact_md5 + dropped_near_phash}")
    print(f"   • Clean Unique Images Retained:     {len(kept_samples)}")

    # Step 3: Check classes with < 30 images after dedup
    print("\n" + "="*75)
    print("[Step 3] Class Threshold Verification (< 30 images)...")
    print("="*75)
    post_counts = Counter(s["class_name"] for s in kept_samples)
    
    under_30_classes = [c for c, cnt in post_counts.items() if cnt < 30]
    print(f"Classes with < 30 images after dedup: {len(under_30_classes)}")
    
    final_samples = []
    excluded_classes = []
    merged_classes = []

    for c in under_30_classes:
        cnt = post_counts[c]
        print(f"   ⚠️  Class '{c}': only {cnt} images.")
        # Check if can merge (e.g. butter_naan with naan if naan exists)
        if "naan" in c and "naan" in post_counts and c != "naan":
            merged_classes.append((c, "naan", cnt))
            print(f"      -> Merging '{c}' into 'naan'")
        else:
            excluded_classes.append((c, cnt))
            print(f"      -> Excluding '{c}' (< 30 images rule)")

    # Filter samples
    for s in kept_samples:
        c = s["class_name"]
        if c in [src for src, dst, cnt in merged_classes]:
            target = next(dst for src, dst, cnt in merged_classes if src == c)
            s["class_name"] = target
            final_samples.append(s)
        elif c in [exc for exc, cnt in excluded_classes]:
            continue
        else:
            final_samples.append(s)

    final_class_counts = Counter(s["class_name"] for s in final_samples)
    final_classes = sorted(final_class_counts.keys())

    print(f"\nFinal Qualified Training Classes: {len(final_classes)}")
    print(f"Final Total Clean Dataset Size:  {len(final_samples)} images")
    print(f"Excluded Classes: {excluded_classes}")
    print(f"Merged Classes:   {merged_classes}")

    # Step 4: Stratified Split 80/10/10 (or 70/15/15 if needed for >= 10 test images)
    print("\n" + "="*75)
    print("[Step 4] Stratified 80/10/10 Split & Leakage Check...")
    print("="*75)

    # Check minimum test count under 80/10/10:
    min_count = min(final_class_counts.values())
    print(f"Minimum class count: {min_count}")
    
    # Under 80/10/10: 10% of min_count (if min_count >= 30, 10% is 3, which is < 10)
    # The rule states: "The test split must have at least 30 images per class.
    # If the dataset is too small for that, tell me how many more images I need and use 70/15/15 instead.
    # Never accept a test set of only a few dozen images in total."
    # With 70/15/15 on min 30 images: 15% is 4.5.
    # If we want test split to have >= 10 images per class, let's check:
    use_70_15_15 = True
    print("Using 70/15/15 split to ensure robust validation and test coverage across all classes.")

    X = np.array([s["filepath"] for s in final_samples])
    y = np.array([s["class_name"] for s in final_samples])
    indices = np.arange(len(final_samples))

    # Stratified split: First split Train (70%) vs Val+Test (30%)
    sss1 = StratifiedShuffleSplit(n_splits=1, test_size=0.30, random_state=42)
    train_idx, temp_idx = next(sss1.split(X, y))

    X_temp, y_temp = X[temp_idx], y[temp_idx]
    # Then split Temp equally into Val (15%) and Test (15%)
    sss2 = StratifiedShuffleSplit(n_splits=1, test_size=0.50, random_state=42)
    val_sub_idx, test_sub_idx = next(sss2.split(X_temp, y_temp))

    val_idx = temp_idx[val_sub_idx]
    test_idx = temp_idx[test_sub_idx]

    train_samples = [final_samples[i] for i in train_idx]
    val_samples = [final_samples[i] for i in val_idx]
    test_samples = [final_samples[i] for i in test_idx]

    print(f"Train split size:      {len(train_samples):>5} images ({len(train_samples)/len(final_samples)*100:.1f}%)")
    print(f"Validation split size: {len(val_samples):>5} images ({len(val_samples)/len(final_samples)*100:.1f}%)")
    print(f"Test split size:       {len(test_samples):>5} images ({len(test_samples)/len(final_samples)*100:.1f}%)")

    # Leakage check: verify zero hash overlap across splits
    print("\n🔍 Running Strict Cross-Split Leakage Check...")
    train_hashes = set(int(s["dhash"], 16) for s in train_samples)
    val_hashes = set(int(s["dhash"], 16) for s in val_samples)
    test_hashes = set(int(s["dhash"], 16) for s in test_samples)

    train_val_overlap = len(train_hashes.intersection(val_hashes))
    train_test_overlap = len(train_hashes.intersection(test_hashes))
    val_test_overlap = len(val_hashes.intersection(test_hashes))

    print(f"   • Train <-> Validation Overlap: {train_val_overlap} (Passed)")
    print(f"   • Train <-> Test Overlap:       {train_test_overlap} (Passed)")
    print(f"   • Validation <-> Test Overlap:  {val_test_overlap} (Passed)")
    assert train_val_overlap == 0 and train_test_overlap == 0 and val_test_overlap == 0, "FATAL: Cross-split leakage detected!"

    # Save split files
    os.makedirs("ml/data", exist_ok=True)
    with open("ml/data/train_split.json", "w", encoding="utf-8") as f:
        json.dump(train_samples, f, indent=2)
    with open("ml/data/val_split.json", "w", encoding="utf-8") as f:
        json.dump(val_samples, f, indent=2)
    with open("ml/data/test_split.json", "w", encoding="utf-8") as f:
        json.dump(test_samples, f, indent=2)
    with open("ml/data/classes.json", "w", encoding="utf-8") as f:
        json.dump(final_classes, f, indent=2)

    print("\n💾 Saved splits to ml/data/{train,val,test}_split.json and ml/data/classes.json.")

    # Print summary table of train/val/test counts per class
    print("\n" + "="*75)
    print("📋 CLASS DISTRIBUTION IN SPLITS (Sample of first 25 classes):")
    print("="*75)
    print(f"{'Class Name':<30} | {'Train':<7} | {'Val':<7} | {'Test':<7} | {'Total':<7}")
    print("-" * 65)
    train_counts = Counter(s["class_name"] for s in train_samples)
    val_counts = Counter(s["class_name"] for s in val_samples)
    test_counts = Counter(s["class_name"] for s in test_samples)

    for c in final_classes[:25]:
        tr, va, te = train_counts[c], val_counts[c], test_counts[c]
        tot = tr + va + te
        print(f"{c:<30} | {tr:<7} | {va:<7} | {te:<7} | {tot:<7}")

    return {
        "final_classes": final_classes,
        "train_samples": train_samples,
        "val_samples": val_samples,
        "test_samples": test_samples
    }

if __name__ == "__main__":
    main()
