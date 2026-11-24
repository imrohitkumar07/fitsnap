# FitSnap Project Cleanup & Storage Architecture

This document describes the items removed during repository optimization and the exact commands to restore or regenerate them if needed.

## 1. What Was Removed & Why

| Category | Size | Reason for Removal | Status |
|---|:---:|---|---|
| **Regenerable Tensor Caches** (`ml/data/*.npy`) | ~8.04 GB | Precomputed resized tensors (`train_128.npy`, `train_176.npy`, `train_224.npy`, `val_*.npy`). Not needed for inference. | Fully regenerable |
| **Raw Training Images** (`dataset256/`, `Food_Classification/`) | ~5.45 GB | Training images from UEC-FOOD256 and Indian food datasets. Models are fully trained and checkpoints are preserved. | Retraining only |
| **Outdated Checkpoints** (`cnn_last.pt`, `checkpoint_latest_unet.pt`) | ~449 MB | Interrupted or last-epoch checkpoints; superseded by `cnn_best.pt` and `unet_best.pt`. | Obsolete |
| **Historical Dataset Archive** (`ml/archive_old_dataset/`) | ~486 MB | Superseded 20-class test dataset from Phase 1. | Obsolete |
| **Redundant DB Snapshots** (`fitsnap/server/backups/*.db`) | ~60 MB | 9 duplicate SQLite database clones. Latest snapshot preserved in `archive/backups/`. | Archived |
| **Duplicate Image Caches** (`data/processed/seg/`) | ~87 MB | Intermediate OpenCV mask outputs; regenerable on-the-fly. | Regenerable |

**Total Space Saved**: ~15.45 GB (97.6% reduction in workspace files).

---

## 2. Essential Files Preserved (Never Removed)

- **`models/` & `ml/checkpoints/`**:
  - `cnn_best.pt`: Best ResNet-34 classification checkpoint (64.54% Top-1, 86.35% Top-5).
  - `unet_best.pt`: Best 4-level U-Net segmentation checkpoint (67.76% mIoU, 77.32% Dice).
  - `temperature.json`: Calibrated Platt scaling temperature (T=0.751, ECE=2.83%).
  - `class_names.json`: 272 unified food class index.
  - `metrics_*.json` & `history_*.json`: Complete benchmark results and 99/35-epoch training loss/acc logs.
- **Source Code**:
  - `main.py`: Unified ML CLI (prepare, train, evaluate, export).
  - `app.py`: Production FastAPI server with `/predict`, food/water/workout logging, diary, and meal planner.
  - `frontend/` & `fitsnap/client/`: React 3D web application.
  - `fitsnap/server/`: Express backend with Prisma ORM and `dev.db`.
- **Data & Benchmarks**:
  - `data/nutrition.csv`: 7,404 curated food database (USDA + Indian items).
  - `data/curated/`: Golden review CSVs and verified portion maps.
  - `data/personal_test/`: Real photos and out-of-distribution test images.
  - `reports/`: Self-contained HTML notebook reports and figures.

---

## 3. How to Restore or Regenerate

### A. Run Application Smoke Test
```bash
python scripts/smoke_test.py
# Or:
python app.py --smoke-test
```

### B. Verify Production Artifacts
```bash
python main.py export
```

### C. Evaluate Models
```bash
python main.py evaluate --model cnn
python main.py evaluate --model unet
```

### D. Re-Train or Rebuild Caches (If Raw Data is Restored)
If you place raw images back into `dataset256/` and `Food_Classification/`:
```bash
python scripts/rebuild_cache.py
# Or:
python main.py prepare
```
