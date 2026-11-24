"""
ml/inspect_both_datasets.py
High-performance read-only inspection of ./dataset256 and ./Food_Classification
Multithreaded image verification, resolution profiling, MD5 exact duplicate detection,
vectorized numpy dHash perceptual duplicate analysis, class imbalance metrics,
inter-dataset overlap analysis, and dataset merging proposals.
"""

import os
import sys
import glob
import hashlib
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from PIL import Image
from tqdm import tqdm

# UTF-8 stdout
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

def process_single_image(args):
    """Worker function to inspect a single image file."""
    fp, class_name = args
    ext = os.path.splitext(fp)[1].lower()
    try:
        with open(fp, "rb") as bf:
            raw_bytes = bf.read()
            md5 = hashlib.md5(raw_bytes).hexdigest()
        
        with Image.open(fp) as img:
            img.load()
            w, h = img.size
            # Fast vectorized dHash
            gray_small = img.convert("L").resize((9, 8), Image.Resampling.BILINEAR)
            arr = np.asarray(gray_small)
            diff = arr[:, 1:] > arr[:, :-1]
            dhash_val = int.from_bytes(np.packbits(diff).tobytes(), "big")

        return (True, fp, class_name, md5, (w, h), ext, dhash_val, None)
    except Exception as e:
        return (False, fp, class_name, None, None, ext, None, str(e))

def inspect_dataset_folder(root_dir, name, is_uec=False, category_map=None):
    print(f"\n{'='*75}")
    print(f"📊 INSPECTING: {name} ({root_dir})")
    print(f"{'='*75}")

    if not os.path.exists(root_dir):
        print(f"❌ Error: {root_dir} does not exist!")
        return None

    # Meta / Docs
    doc_files = []
    for item in os.listdir(root_dir):
        if item.lower().endswith(('.txt', '.md', '.pdf', '.csv')):
            doc_files.append(item)
    print(f"📄 Documentation / Meta Files in root: {doc_files}")
    for doc in doc_files:
        dp = os.path.join(root_dir, doc)
        if os.path.isfile(dp):
            try:
                with open(dp, 'r', encoding='utf-8', errors='ignore') as f:
                    preview = [f.readline().strip() for _ in range(4)]
                    print(f"   • {doc} (preview): {preview}")
            except Exception as e:
                print(f"   • {doc}: could not read ({e})")

    # Find class folders
    subdirs = [d for d in os.listdir(root_dir) if os.path.isdir(os.path.join(root_dir, d))]
    actual_class_dir = root_dir
    if "UECFOOD256" in subdirs and len(subdirs) <= 5:
        actual_class_dir = os.path.join(root_dir, "UECFOOD256")
        subdirs = [d for d in os.listdir(actual_class_dir) if os.path.isdir(os.path.join(actual_class_dir, d))]

    if all(d.isdigit() for d in subdirs):
        subdirs.sort(key=int)
    else:
        subdirs.sort()

    print(f"📁 Organization: Class subdirectories: {len(subdirs)}")
    
    # Collect all image tasks
    tasks = []
    non_img_files = Counter()
    for c in subdirs:
        c_dir = os.path.join(actual_class_dir, c)
        c_name = category_map.get(c, c) if category_map else c
        for f in os.listdir(c_dir):
            fp = os.path.join(c_dir, f)
            if not os.path.isfile(fp):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in ['.txt', '.csv', '.json', '.xml']:
                non_img_files[ext] += 1
                continue
            tasks.append((fp, c_name))

    print(f"🖼️  Image Files to process: {len(tasks)} (Non-image annotations: {dict(non_img_files)})")

    # Multithreaded execution
    class_counts = Counter()
    exts = Counter()
    sizes = Counter()
    corrupted = []
    md5_to_paths = defaultdict(list)
    dhash_map = {} # path -> (c_name, dhash)

    print(f"🚀 Running multithreaded integrity check & dHash computation (16 workers)...")
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = pool.map(process_single_image, tasks, chunksize=64)
        for ok, fp, c_name, md5, size, ext, dh, err in tqdm(results, total=len(tasks), desc=f"Processing {name}"):
            exts[ext] += 1
            if ok:
                class_counts[c_name] += 1
                sizes[size] += 1
                md5_to_paths[md5].append(fp)
                dhash_map[fp] = (c_name, dh)
            else:
                corrupted.append((fp, err))

    exact_dups = {k: v for k, v in md5_to_paths.items() if len(v) > 1}
    exact_dup_images = sum(len(v) - 1 for v in exact_dups.values())

    # Summary
    counts_list = list(class_counts.values())
    min_c = min(counts_list) if counts_list else 0
    max_c = max(counts_list) if counts_list else 0
    avg_c = sum(counts_list) / len(counts_list) if counts_list else 0
    med_c = float(np.median(counts_list)) if counts_list else 0.0

    print(f"\n--- {name} Inspection Summary ---")
    print(f"Total Valid Images:    {len(dhash_map)}")
    print(f"Total Corrupted:       {len(corrupted)}")
    if corrupted:
        for cf, err in corrupted[:5]:
            print(f"   ❌ Corrupted: {cf} ({err})")
    print(f"File Extensions:       {dict(exts)}")
    print(f"Unique Resolutions:    {len(sizes)} distinct dimensions")
    print(f"Top 5 Resolutions:     {sizes.most_common(5)}")
    print(f"Number of Classes:     {len(class_counts)}")
    print(f"Class Distribution:    Min={min_c}, Max={max_c}, Median={med_c:.1f}, Mean={avg_c:.1f}")
    print(f"Class Imbalance Ratio: {max_c/max(min_c, 1):.2f}x (Max/Min)")
    print(f"Exact Duplicate Images:{exact_dup_images} across {len(exact_dups)} MD5 groups")

    return {
        "name": name,
        "root": root_dir,
        "class_dir": actual_class_dir,
        "total_imgs": len(dhash_map),
        "classes": class_counts,
        "exts": dict(exts),
        "sizes": sizes.most_common(5),
        "corrupted": corrupted,
        "exact_dups": exact_dups,
        "dhash_map": dhash_map,
        "meta_files": doc_files
    }

def main():
    cat_map = {}
    uec_cat_file = "dataset256/category.txt"
    if not os.path.exists(uec_cat_file):
        uec_cat_file = "fitsnap/UECFOOD256/category.txt"
    if os.path.exists(uec_cat_file):
        with open(uec_cat_file, 'r', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) >= 2 and parts[0].isdigit():
                    cat_map[parts[0]] = parts[1]

    d256_info = inspect_dataset_folder("dataset256", "dataset256 (UEC-FOOD256)", is_uec=True, category_map=cat_map)
    fc_info = inspect_dataset_folder("Food_Classification", "Food_Classification (Indian & Popular Foods)", is_uec=False)

    if not d256_info or not fc_info:
        print("Inspection aborted due to missing directory.")
        return

    # Check Class Name Overlap
    print(f"\n{'='*75}")
    print("🔄 CLASS OVERLAP ANALYSIS BETWEEN DATASETS")
    print(f"{'='*75}")
    d256_classes = {c.lower().strip(): c for c in d256_info["classes"].keys()}
    fc_classes = {c.lower().strip(): c for c in fc_info["classes"].keys()}

    exact_matches = set(d256_classes.keys()).intersection(set(fc_classes.keys()))
    print(f"Total dataset256 classes:          {len(d256_classes)}")
    print(f"Total Food_Classification classes:    {len(fc_classes)}")
    print(f"Exact Matching Class Names ({len(exact_matches)}):")
    for m in sorted(exact_matches):
        orig_d = d256_classes[m]
        orig_fc = fc_classes[m]
        print(f"   • '{m}': {d256_info['classes'][orig_d]} imgs in d256, {fc_info['classes'][orig_fc]} imgs in Food_Classification")

    # Near matches (fuzzy / substring)
    print("\nFuzzy / Substring Overlaps:")
    for fc_key, fc_orig in sorted(fc_classes.items()):
        if fc_key in exact_matches:
            continue
        sims = []
        for d_key, d_orig in d256_classes.items():
            if fc_key in d_key or d_key in fc_key:
                sims.append(d_orig)
        if sims:
            print(f"   • Food_Classification '{fc_orig}' <-> dataset256 {sims}")

    # Check Duplicates BETWEEN the two datasets
    print(f"\n{'='*75}")
    print("🔍 CHECKING PERCEPTUAL DUPLICATES BETWEEN THE TWO DATASETS")
    print(f"{'='*75}")
    fc_hashes = fc_info["dhash_map"]
    d256_hashes = d256_info["dhash_map"]

    d256_hash_table = defaultdict(list)
    for p, (c, h) in d256_hashes.items():
        d256_hash_table[h].append((p, c))

    inter_exact_dups = []
    for fp_fc, (c_fc, h_fc) in fc_hashes.items():
        if h_fc in d256_hash_table:
            for p_d, c_d in d256_hash_table[h_fc]:
                inter_exact_dups.append((fp_fc, p_d, c_fc, c_d))

    print(f"Inter-dataset Identical Perceptual Hashes (dHash == 0): {len(inter_exact_dups)}")
    if inter_exact_dups:
        for f1, f2, c1, c2 in inter_exact_dups[:10]:
            print(f"   ⚠️ Shared Image: {os.path.basename(f1)} ({c1}) <==> {os.path.basename(f2)} ({c2})")

    # Print Class Distribution Tables
    print(f"\n{'='*75}")
    print("📋 FOOD_CLASSIFICATION CLASS TABLE (All 20 Classes):")
    print(f"{'='*75}")
    print(f"{'Class Name':<25} | {'Count':<8} | {'Share (%)':<10}")
    print("-" * 50)
    fc_total = fc_info["total_imgs"]
    for c, cnt in sorted(fc_info["classes"].items(), key=lambda x: x[1], reverse=True):
        share = (cnt / fc_total) * 100 if fc_total else 0
        print(f"{c:<25} | {cnt:<8} | {share:6.2f}%")

    print(f"\n{'='*75}")
    print("📋 DATASET256 CLASS TABLE (Summary of 256 Classes):")
    print(f"{'='*75}")
    sorted_d256 = sorted(d256_info["classes"].items(), key=lambda x: x[1], reverse=True)
    print(f"Top 15 Classes by Count:")
    for c, cnt in sorted_d256[:15]:
        print(f"  {c:<30} : {cnt:>5} images")
    print(f"\nBottom 15 Classes by Count:")
    for c, cnt in sorted_d256[-15:]:
        print(f"  {c:<30} : {cnt:>5} images")

if __name__ == "__main__":
    main()
