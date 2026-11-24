"""
pack_dataset.py
Packs pre-resized cached images into high-speed uint8 numpy memmap arrays.
Eliminates all per-epoch disk file opens, libjpeg decodings, and OS filesystem overhead.
"""

import os
import sys
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import numpy as np

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"

def pack_split(split_name: str, img_size: int = 128):
    split_file = DATA_DIR / f"{split_name}_split.json"
    with open(split_file, "r", encoding="utf-8") as f:
        samples = json.load(f)

    with open(DATA_DIR / "classes.json", "r", encoding="utf-8") as f:
        classes = json.load(f)
    class_to_idx = {c: i for i, c in enumerate(classes)}

    out_img_file = DATA_DIR / f"{split_name}_{img_size}.npy"
    out_lbl_file = DATA_DIR / f"{split_name}_{img_size}_labels.npy"

    if out_img_file.exists() and out_lbl_file.exists():
        print(f"📦 Found existing packed dataset: {out_img_file} ({out_img_file.stat().st_size / (1024**2):.1f} MB)")
        return out_img_file, out_lbl_file

    print(f"\n📦 Packing {len(samples):,} images ({split_name}) at {img_size}x{img_size} into {out_img_file.name}...")
    t0 = time.time()

    N = len(samples)
    img_array = np.lib.format.open_memmap(str(out_img_file), mode="w+", dtype=np.uint8, shape=(N, img_size, img_size, 3))
    label_array = np.zeros(N, dtype=np.int64)

    cache_dir = DATA_DIR / "cache" / str(img_size)

    def load_single(i_s):
        idx, s = i_s
        cache_id = s.get("md5", s.get("cache_id"))
        cached_fp = cache_dir / f"{cache_id}.jpg" if cache_id else None

        if cached_fp and cached_fp.exists():
            fp = cached_fp
        else:
            fp = PROJECT_ROOT / s["filepath"]

        try:
            with Image.open(fp) as im:
                im = im.convert("RGB")
                if im.size != (img_size, img_size):
                    im = im.resize((img_size, img_size), Image.Resampling.BILINEAR)
                arr = np.array(im, dtype=np.uint8)
        except Exception:
            arr = np.zeros((img_size, img_size, 3), dtype=np.uint8)

        lbl = class_to_idx.get(s["class_name"], 0)
        return idx, arr, lbl

    with ThreadPoolExecutor(max_workers=16) as ex:
        for idx, arr, lbl in ex.map(load_single, enumerate(samples)):
            img_array[idx] = arr
            label_array[idx] = lbl
            if (idx + 1) % 5000 == 0 or (idx + 1) == N:
                print(f"   Packed {idx + 1:05d} / {N:05d} ({((idx + 1) / N) * 100:.1f}%) in {time.time() - t0:.1f}s", flush=True)

    img_array.flush()
    np.save(str(out_lbl_file), label_array)
    dur = time.time() - t0
    print(f"✅ Successfully created {out_img_file.name} ({out_img_file.stat().st_size / (1024**2):.1f} MB) in {dur:.1f}s!")
    return out_img_file, out_lbl_file

if __name__ == "__main__":
    for sz in [128, 176, 224]:
        pack_split("train", sz)
        pack_split("val", sz)
    print("\nAll splits (128px, 176px, 224px) packed successfully!")
