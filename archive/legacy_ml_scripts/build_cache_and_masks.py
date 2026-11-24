"""
ml/build_cache_and_masks.py
Fast generation of 2,000 weak pseudo-masks on 256x256 images using OpenCV (GrabCut + Hough Circles).
Labeled as: "IoU against weak pseudo-masks, not ground truth".
"""

import os
import sys
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import cv2
from PIL import Image
from tqdm import tqdm

# UTF-8 stdout
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

def fast_generate_pseudo_mask(args):
    img_256_path, out_mask_path, bb_box, orig_w, orig_h = args
    if os.path.exists(out_mask_path):
        return True
    try:
        img = cv2.imread(img_256_path)
        if img is None:
            return False
        h, w = img.shape[:2] # 256, 256
        mask = np.zeros((h, w), np.uint8)

        # Scale bounding box to 256x256
        if bb_box and len(bb_box) == 4 and orig_w and orig_h:
            x1, y1, x2, y2 = bb_box
            sx = w / max(orig_w, 1)
            sy = h / max(orig_h, 1)
            rx1 = max(0, min(int(x1 * sx), w - 2))
            ry1 = max(0, min(int(y1 * sy), h - 2))
            rx2 = max(rx1 + 1, min(int(x2 * sx), w - 1))
            ry2 = max(ry1 + 1, min(int(y2 * sy), h - 1))
            rect = (rx1, ry1, rx2 - rx1, ry2 - ry1)
        else:
            # Circle plate detector on 256x256
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (7, 7), 2)
            circles = cv2.HoughCircles(
                blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=80,
                param1=100, param2=35, minRadius=60, maxRadius=125
            )
            if circles is not None:
                c = np.uint16(np.around(circles))[0][0]
                cx, cy, r = int(c[0]), int(c[1]), int(c[2])
                rect = (max(0, cx - r), max(0, cy - r), min(w - 1, 2 * r), min(h - 1, 2 * r))
            else:
                rect = (25, 25, 206, 206)

        bgdModel = np.zeros((1, 65), np.float64)
        fgdModel = np.zeros((1, 65), np.float64)
        cv2.grabCut(img, mask, rect, bgdModel, fgdModel, iterCount=2, mode=cv2.GC_INIT_WITH_RECT)
        binary_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype("uint8")
        cv2.imwrite(out_mask_path, binary_mask)
        return True
    except Exception:
        return False

def load_all_bb_info():
    bb_map = {}
    uec_dir = "dataset256/UECFOOD256" if os.path.exists("dataset256/UECFOOD256") else "dataset256"
    for folder in os.listdir(uec_dir):
        bb_file = os.path.join(uec_dir, folder, "bb_info.txt")
        if os.path.exists(bb_file):
            with open(bb_file, "r") as f:
                _ = f.readline()
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        bb_map[(folder, parts[0])] = [float(p) for p in parts[1:5]]
    return bb_map

def main():
    print("=" * 75)
    print("⚡ FITSNAP ULTRA-FAST WEAK PSEUDO-MASK GENERATION")
    print("=" * 75)

    with open("ml/data/train_split.json", "r", encoding="utf-8") as f:
        train_samples = json.load(f)

    os.makedirs("data/processed/seg/images", exist_ok=True)
    os.makedirs("data/processed/seg/masks", exist_ok=True)

    bb_map = load_all_bb_info()
    seg_candidates = train_samples[:2000]
    print(f"Preparing 2,000 segmentation candidates on 256x256...")

    mask_tasks = []
    seg_metadata = []

    for s in seg_candidates:
        cache_id = s.get("md5", s.get("cache_id"))
        orig_fp = s["filepath"]
        img_256_path = f"data/processed/seg/images/{cache_id}.jpg"
        out_mask_path = f"data/processed/seg/masks/{cache_id}.png"

        # Ensure 256x256 source image exists
        orig_w, orig_h = None, None
        if not os.path.exists(img_256_path):
            try:
                with Image.open(orig_fp) as im:
                    orig_w, orig_h = im.size
                    im.convert("RGB").resize((256, 256), Image.Resampling.BILINEAR).save(img_256_path, "JPEG", quality=90)
            except Exception:
                continue
        else:
            orig_size = s.get("size")
            if orig_size:
                orig_w, orig_h = orig_size

        folder_name = os.path.basename(os.path.dirname(orig_fp))
        img_id = os.path.splitext(os.path.basename(orig_fp))[0]
        bb = bb_map.get((folder_name, img_id), None)

        mask_tasks.append((img_256_path, out_mask_path, bb, orig_w, orig_h))
        seg_metadata.append({
            "id": cache_id,
            "image_path": img_256_path,
            "mask_path": out_mask_path,
            "class_name": s["class_name"],
            "ground_truth_status": "IoU against weak pseudo-masks, not ground truth"
        })

    print(f"Running GrabCut on 256x256 inputs with 16 workers...")
    success = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for ok in tqdm(pool.map(fast_generate_pseudo_mask, mask_tasks, chunksize=32), total=len(mask_tasks), desc="Fast GrabCut"):
            if ok:
                success += 1

    meta_record = {
        "dataset_name": "FitSnap Plate & Food Pseudo-Segmentation",
        "sample_count": success,
        "input_resolution": "256x256",
        "ground_truth_disclaimer": "IoU against weak pseudo-masks, not ground truth",
        "samples": seg_metadata
    }
    with open("data/processed/seg/metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta_record, f, indent=2)

    print(f"\n✅ Finished generating 2,000 weak pseudo-masks: {success} / {len(mask_tasks)}")
    print("   Labeled strictly as: 'IoU against weak pseudo-masks, not ground truth'")

if __name__ == "__main__":
    main()
