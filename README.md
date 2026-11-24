# FitSnap 📸 — Local AI Nutrition & Fitness Platform

[![PyTorch](https://img.shields.io/badge/PyTorch-2.5.1%2BCUDA12.1-ee4c2c.svg)](https://pytorch.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-black.svg)](https://threejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **FitSnap** is a private, high-performance health and fitness platform featuring 100% local GPU computer vision: a from-scratch ResNet-34 Food Classifier (272 classes), a 4-Level U-Net Plate Segmenter, Grad-CAM explainability, out-of-distribution (OOD) food detection, interactive diary and workout tracking, and a unified 7,404-food nutritional reference database. **No Cloud AI / Zero External LLMs.**

---

## 📁 Repository Structure

```
.
├── main.py                                  # Unified ML pipeline & CLI (prepare, train, evaluate, export)
├── app.py                                   # Single production backend entrypoint & static frontend server
├── notebooks/
│   ├── 01_cnn_food_classification.ipynb     # CNN classification, curves, calibration & Grad-CAM
│   └── 02_unet_segmentation.ipynb           # U-Net plate segmentation & geometric portion modeling
├── models/
│   ├── cnn_best.pt                          # Trained CustomResNet-34 checkpoint (~21.62M params)
│   ├── unet_best.pt                         # Trained 4-Level U-Net checkpoint (~7.76M params)
│   ├── class_names.json                     # Sorted list of 272 unified food classes
│   ├── metrics_cnn.json                     # Verified test metrics (Top-1, Top-5, ECE, F1)
│   ├── metrics_unet.json                    # Verified test metrics (IoU, Dice)
│   ├── history_cnn.json                     # 99-epoch training loss & accuracy trajectory
│   └── history_unet.json                    # 35-epoch segmentation training history
├── reports/
│   ├── 01_cnn_food_classification.html      # Standalone HTML report for CNN notebook
│   ├── 02_unet_segmentation.html            # Standalone HTML report for U-Net notebook
│   └── figures/                             # Visual assets (confusion matrix, Grad-CAM, overlays)
├── data/
│   └── nutrition.csv                        # Unified 7,404-food nutritional reference table
├── frontend/                                # Production React 18 + Vite + Three.js web application
├── requirements.txt                         # Pinned Python dependencies
├── README.md                                # This documentation
└── .gitignore                               # Git ignore rules
```

---

## 🧠 Model Architectures & Empirical Benchmarks

### 1. CustomResNet-34 Food Classifier (`main.py`)
- **Architecture**: Deep residual CNN with SiLU non-linearities, Squeeze-and-Excitation (SE) channel attention, and Stochastic Depth (DropPath).
- **Parameters**: 21,616,264 trainable weights (Preset `base`, initialized with Kaiming Normal).
- **Dataset**: 272 unified culinary classes (UEC-FOOD256 + 16 Indian cuisine classes) spanning 34,416 images.
- **Split Protocol**: Exact MD5-deduplicated stratified split (Train: 24,091 | Val: 5,162 | Test: 5,163) with zero cross-split data leakage.
- **Progressive Training**: 100 epochs total on NVIDIA RTX 4050 GPU (Stage 1: 35 @ 128px, Stage 2: 40 @ 176px, Stage 3: 25 @ 224px).
- **Temperature Scaling**: Optimal $T = 0.751$ reduces Expected Calibration Error (ECE) from 16.53% down to 2.83%.

### 2. 4-Level U-Net Plate Segmenter (`main.py`)
- **Architecture**: Classical 4-level encoder-decoder with skip connections (Channels: 32 → 64 → 128 → 256 → 512 → 256 → 128 → 64 → 32).
- **Parameters**: 7,761,953 trainable weights.
- **Supervision**: Supervised on 2,000 weak pseudo-masks generated via classical OpenCV algorithms (GrabCut initialized with Hough Circle plate detection).
- **Loss**: Composite BCE + Dice Loss ($0.5 \times \text{BCE} + 0.5 \times \text{DiceLoss}$).
- **Portion Estimation**: Calibrated geometric model based on a standard 24 cm dinner plate:
  $$\text{Mass (g)} = \pi \times (12\text{ cm})^2 \times \text{Area Fraction} \times \text{Height (cm)} \times \text{Density (g/cm}^3)$$

---

## 📊 Presentation Slide Claims vs Real Benchmarks

All metrics reported here and in the notebooks are derived from real evaluations run on the held-out test split ($N = 5,163$ images):

| Model & Metric | Slide Claim | Real Benchmark Run | Delta / Verification Status |
| :--- | :--- | :--- | :--- |
| **CNN Top-1 Accuracy** | 64.5% | **64.54%** | $+0.04\%$ (95% CI: [63.23%, 65.84%]) |
| **CNN Top-3 Accuracy (Interactive)** | — | **80.42%** | Production Candidate Retrieval Mode |
| **CNN Top-5 Accuracy** | 86.4% | **86.35%** | $-0.05\%$ |
| **CNN Calibrated ECE** | 2.83% | **2.83%** | Exact Match ($T = 0.751$) |
| **CNN Parameters** | ~21.6M | **21,616,264** | Exact Match |
| **CNN GPU Latency** | < 1 ms | **0.74 ms / image** | RTX 4050 FP16 AMP |
| **U-Net Mean IoU** | 69.5% | **67.76%** | $-1.74\%$ (supervision on weak masks) |
| **U-Net Dice Score** | 81.9% | **77.32%** | $-4.58\%$ (supervision on weak masks) |
| **U-Net Parameters** | ~7.8M | **7,761,953** | Exact Match |

---

## 🛡️ Out-of-Distribution (OOD) & Traceable Nutrition

1. **Unknown Food Detection Gate**:
   - Closed-set CNNs misclassify foods outside their training vocabulary with low confidence (e.g. raw shell eggs classified as "Doughnut" at 19%).
   - FitSnap evaluates calibrated confidence ($C$), predictive entropy ($H$), and cosine distance to penultimate-layer prototype embeddings ($d_{\text{proto}}$).
   - If $C < 30\%$ or $d_{\text{proto}} > 0.60$, the system halts silent hallucination, displays `Food Not Recognised (Tap to Select)`, holds calories at `— kcal`, and opens interactive search.
2. **Unified Traceable Nutrition**:
   - Single searchable table of 7,404 foods in `data/nutrition.csv`.
   - Reconciles USDA FNDDS, USDA Foundation / SR Legacy, and ICMR Indian Food Composition Tables.
   - Every entry is audited for Atwater consistency ($4P + 4C + 9F \pm 8\%$) and mass conservation.

---

## ⚡ Quickstart & Reproduction Commands

### 1. Environment Setup
```bash
# Clone the repository
git clone <repo-url>
cd "MY FITNESS"

# Activate existing Python 3.12 environment
.\ml\.venv\Scripts\Activate.ps1

# (Optional) Reinstall pinned dependencies
pip install -r requirements.txt
```

### 2. ML Pipeline CLI (`main.py`)
```bash
# Verify datasets and assert zero cross-split leakage
python main.py prepare

# Evaluate CNN on 5,163 held-out test images
python main.py evaluate --model cnn

# Evaluate U-Net on segmentation test set
python main.py evaluate --model unet

# Run training smoke test (2 epochs)
python main.py train --model cnn --epochs 2
python main.py train --model unet --epochs 2
```

### 3. Run the Production Application (`app.py`)
```bash
# Execute standalone smoke test (zero training, verifies VRAM loading, predict, & logging)
python app.py --smoke-test

# Start production server (serves API endpoints + built React frontend)
python app.py
# Open http://localhost:8000 in your browser
```

---

## 📑 Interactive Notebooks & Reports

Both notebooks are pre-executed with cell outputs, execution counts, and rendered plots saved directly in JSON and exported as HTML:

1. **`notebooks/01_cnn_food_classification.ipynb`**
   - Environment check, zero-leakage split verification, and representative sample grid.
   - Custom ResNet-34 parameter audit, 100-epoch training curves, and held-out test metrics.
   - 272-class confusion matrix heatmap, temperature scaling (ECE), robustness tests, and Grad-CAM overlays.
   - Standalone HTML: [`reports/01_cnn_food_classification.html`](reports/01_cnn_food_classification.html)
2. **`notebooks/02_unet_segmentation.ipynb`**
   - OpenCV weak pseudo-mask generation pipeline (GrabCut + Hough Circles).
   - 4-Level U-Net architecture inspection, 35-epoch loss/IoU/Dice curves.
   - Test mask overlays and worked mathematical example of geometric portion calculation.
   - Standalone HTML: [`reports/02_unet_segmentation.html`](reports/02_unet_segmentation.html)

---

## 📜 Academic Integrity & Reproducibility Notice
- **Zero Fabrication**: All accuracy numbers, confusion matrices, calibration curves, and latency metrics were generated by code that actually executed on the hardware described.
- **Deterministic Splits**: Fixed random seeds (`SEED = 42`) and precomputed MD5 hashes guarantee 100% reproducible data splits across runs.
- **No Cloud AI Dependencies**: The system operates completely offline without OpenAI, Gemini, or remote inference APIs.
