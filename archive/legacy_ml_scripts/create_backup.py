"""
create_backup.py
Creates a compact backup ZIP containing:
1. ml/checkpoints (cnn_best.pt, unet_best.pt, temperature.json)
2. ml/results (results.md, logs, confusion matrix, gradcam samples, unet overlays)
3. Class files (ml/class_map.json, ml/data/classes.json, splits, seg/metadata.json)
"""

import os
import sys
import zipfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
BACKUP_PATH = PROJECT_ROOT / "fitsnap_ml_backup_20261101.zip"

print(f"[BACKUP] Creating ML Backup ZIP at: {BACKUP_PATH}...")

with zipfile.ZipFile(BACKUP_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
    # 1. ml/checkpoints
    ckpt_dir = BASE_DIR / "checkpoints"
    for f in ckpt_dir.glob("*"):
        if f.is_file() and not f.name.endswith(".tmp"):
            # Include best models and calibration
            if f.name in ["cnn_best.pt", "unet_best.pt", "best_unet.pth", "temperature.json"]:
                arcname = f"ml/checkpoints/{f.name}"
                print(f"  + {arcname} ({f.stat().st_size / 1e6:.1f} MB)")
                zipf.write(f, arcname)

    # 2. ml/results
    results_dir = BASE_DIR / "results"
    for root, dirs, files in os.walk(results_dir):
        for file in files:
            full_path = Path(root) / file
            rel_path = full_path.relative_to(PROJECT_ROOT)
            if not file.endswith(".tmp") and full_path.stat().st_size < 100 * 1024 * 1024:
                print(f"  + {rel_path} ({full_path.stat().st_size / 1024:.1f} KB)")
                zipf.write(full_path, str(rel_path).replace("\\", "/"))

    # 3. Class and split files
    class_files = [
        BASE_DIR / "class_map.json",
        BASE_DIR / "data" / "classes.json",
        BASE_DIR / "data" / "train_split.json",
        BASE_DIR / "data" / "val_split.json",
        BASE_DIR / "data" / "test_split.json",
        PROJECT_ROOT / "data" / "processed" / "seg" / "metadata.json"
    ]
    for cf in class_files:
        if cf.exists():
            rel_path = cf.relative_to(PROJECT_ROOT)
            print(f"  + {rel_path} ({cf.stat().st_size / 1024:.1f} KB)")
            zipf.write(cf, str(rel_path).replace("\\", "/"))

print(f"\n[OK] Backup complete! Archive size: {BACKUP_PATH.stat().st_size / 1e6:.1f} MB")
print(f"Location: {BACKUP_PATH}")
