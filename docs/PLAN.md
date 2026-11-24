# FitSnap — Master Architectural Blueprint & Implementation Plan

**Final Model Policy & System Specification (Strict Syllabus Compliance)**

---

## 1. Core Model Policy

1. **Two Models Only (Both PyTorch, Written & Trained by Us on Local GPU)**:
   - **Model 1: Custom Residual CNN Food Classifier (Module 1)**
     - ResNet-style custom architecture with Residual Blocks, BatchNorm, SiLU activations, Squeeze-and-Excitation (SE) channel attention, Global Average Pooling (GAP), Dropout, and Linear classification head.
     - Presets:
       - `small`: ~2.1M parameters (Depth [2, 2, 2, 2], Channels [32, 64, 128, 256])
       - `base`: ~10.4M parameters (Depth [3, 4, 6, 3], Channels [64, 128, 256, 512])
       - `large`: ~24.8M parameters (Depth [3, 4, 18, 3], Channels [64, 128, 256, 512] with SE)
     - Random weight initialization (`use_pretrained=False`, Kaiming Normal init, zero-init last BN gamma).
   - **Model 2: 4-Level U-Net Food & Plate Segmenter (Module 3)**
     - Classical Encoder-Decoder with skip connections (Channels: 32 -> 64 -> 128 -> 256 -> 512).
     - Trained on weak pseudo-masks generated via classical OpenCV (GrabCut + Hough Circle plate boundary detection + color clustering) across dataset images.
     - Explicitly labeled in all metrics and reports as *"trained on weak masks"*.

2. **Core Techniques (Not External Models)**:
   - **Grad-CAM (Explainability / XAI)**: PyTorch forward/backward gradient hooks on the final convolutional stage of the custom CNN, producing calibrated thermal heatmaps.
   - **FGSM (Fast Gradient Sign Method)**: Adversarial robustness evaluation ($\epsilon \in \{1/255, 2/255, 4/255\}$) and robustness test matrix.

3. **Strict Cloud/LLM Ban**:
   - **ZERO LLMs, ZERO Gemini, ZERO Cloud Vision APIs, ZERO SAM, ZERO ViT**.
   - Removed all cloud AI dependencies, API keys, and SDK imports.
   - All auxiliary NLP tasks (voice meal logging, natural language parsing, coaching insights, meal planner, Ask FitSnap assistant) use 100% deterministic, offline rule-based parsers and heuristic search algorithms.

---

## 2. Seven-Part Implementation Breakdown

### Part 1: GPU Setup & Verification
- Verify NVIDIA GeForce RTX 4050 Laptop GPU (6,140.5 MiB VRAM, Driver 528.97, CUDA 12.0/12.1).
- Script `ml/check_gpu.py`: Strict assertions on CUDA availability, VRAM memory info, and 4096x4096 benchmark test. Training scripts halt immediately if CUDA is unavailable (zero silent CPU fallback).
- Windows configuration: `num_workers=4` with safe Windows multiprocessing error fallback to `0`, protected with `if __name__ == '__main__':` guards.

### Part 2: Data Inspection & Preprocessing
- Inspection of `./fitsnap/Food Classification Dataset`: 34 classes, exactly 10 images per class (340 total images), 256x256 resolution, 100% JPG, 0 corrupted, 0 perceptual hash duplicates.
- Stratified 80/10/10 split (seed 42) with near-duplicate cross-split leakage verification.
- Offline pre-resizing cache (`ml/data/cache/128/` and `ml/data/cache/224/`) to eliminate disk bottlenecks during training.
- Segmentation data check: No external masks found. Classical OpenCV pseudo-mask generator (`ml/generate_masks.py`) combining Hough circles + GrabCut foreground extraction.

### Part 3: Custom CNN Classifier Training (`ml/train_cnn.py`)
- Mixed precision (`torch.amp.autocast('cuda')` + `GradScaler`), `channels_last` memory format, pinned host memory, non-blocking transfers.
- Progressive resizing schedule: Epochs 1-40 at 128px, 41-100 at 176px, 101-150 at 224px.
- Strong scratch regularizations: MixUp ($\alpha=0.2$), CutMix ($\alpha=1.0$), RandAugment, Random Erasing, Label Smoothing (0.1), Stochastic Depth (0.1), Exponential Moving Average (EMA, decay 0.999).
- Evaluation (`ml/evaluate_cnn.py`): Top-1, Top-5, per-class F1, confusion matrix, ECE calibration with temperature scaling, FGSM robustness drops, and 20 sample Grad-CAM overlays.

### Part 4: U-Net Segmentation Training (`ml/train_unet.py`)
- 4-level U-Net with BCE + Dice composite loss, AdamW ($lr=10^{-3}$) with Cosine Annealing.
- Evaluated on test split for Mean IoU and Dice coefficient against pseudo-masks.

### Part 5: Unified Inference Microservice (`ml/server.py`)
- `POST /predict`:
  1. Quality guard: Laplacian blur detection ($\sigma^2 < 100$), luminance checks, and entropy outlier rejection.
  2. CNN whole-image classification with calibrated top-3 confidence.
  3. U-Net plate and food item segmentation; connected component labeling and contour cropping.
  4. Geometric portion estimation: Plate diameter ($24\text{ cm}$) $\times$ item area share $\times$ typical density = estimated grams $\pm$ range.
  5. Nutrition lookup: USDA FNDDS + Curated Indian dataset mapping.
  6. Grad-CAM visual heatmap overlay (Base64 PNG).

### Part 6: Rule-Based Replacements for LLMs
- **Voice/Text Logging**: Grammar-based regex parser with Hinglish quantity dictionaries (*"do roti"*, *"ek katori dal"*, *"cup"*, *"tablespoon"*), verified with 30+ automated sentence tests.
- **AI Coach Insights**: Rule-based heuristic scoring engine comparing daily macro goals vs. consumed nutrients.
- **Weekly Meal Planner**: Deterministic local combinatorial search matching dietary constraints (Indian Veg / Balanced).
- **Ask FitSnap**: TF-IDF cosine similarity search over offline fitness FAQ database.

### Part 7: Full Application Stack & 3D Dashboard
- Complete MyFitnessPal feature parity: Auth, Mifflin-St Jeor TDEE, Food Diary, MET Cardio, Strength PRs, Intermittent Fasting, 7-Day Meal Planner, Supermarket Aisle Grocery List, Bilingual i18n (English/Hindi), Dark Mode, PWA offline service worker, and 3D Three.js visualizations with "Reduce 3D effects" toggle.

---

## 3. Technology Stack Reference

| Tier | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Three.js, `@react-three/fiber`, `@react-three/drei`, Framer Motion, Recharts, Lucide Icons, PWA Workbox |
| **Backend API** | Node.js 20, Express 4.21, TypeScript, Prisma ORM 6.1, SQLite (`dev.db`), Zod, bcryptjs, jsonwebtoken, multer |
| **ML Engine** | Python 3.12, PyTorch 2.5.1+cu121, CUDA 12.1 (RTX 4050), Albumentations, OpenCV, Scikit-Learn, FastAPI, Uvicorn |
| **Security** | OWASP Top 10 compliance, tenant isolation, EXIF GPS stripping, single-use refresh token rotation |
