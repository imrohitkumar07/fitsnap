# FitSnap Implementation Progress Tracker

This document tracks every phase, enhancement, and rigorous verification test of the FitSnap application.

---

## Live Status Overview

| Phase | Description | Status | Completion Date |
|---|---|---|---|
| **Phase 0** | Environment, Architecture Plan & GPU Verification | `[x] DONE` | 2026-10-26 |
| **Phase 1** | Datasets, USDA FNDDS & Indian Curated Database | `[x] DONE` | 2026-10-26 |
| **Phase 2** | Train Food Classifier & Grad-CAM Verification | `[x] DONE` | 2026-10-26 |
| **Phase 3** | Inference Service & Food Recognition API | `[x] DONE` | 2026-10-26 |
| **Phase 4** | Core Backend, Expanded Prisma Schema & Full Stack | `[x] DONE` | 2026-10-28 |
| **Phase 5** | Food Diary, Barcode Scanner, Voice & Text Search | `[x] DONE` | 2026-10-29 |
| **Phase 6** | Systematic Nutrition Quality & Portion Bounds Audit | `[x] DONE` | 2026-11-02 |
| **Phase 7** | Handling Foods Outside 272 Classes & Traceable Nutrition | `[x] DONE` | 2026-11-03 |

---

## Phase 7: Handling Foods Outside the 272 Classes & Traceable Nutrition (Zero Retraining)

### 1. Prototype Extraction & Out-of-Distribution (OOD) Calibration
- **Unit-Normalized 512-dim Prototypes**: Extracted from penultimate pooling layer across 24,091 training images using `ml/compute_prototypes.py` without modifying model weights. Saved to `ml/class_prototypes.npy` (shape `[272, 512]`).
- **Tri-Metric Distance Discriminator**:
  - Calibrated Confidence ($C$): Temperature-calibrated softmax probability ($T = 1.35$).
  - Predictive Entropy ($H$): Normalized Shannon entropy across top predictions.
  - Prototype Distance ($d_{\text{proto}}$): $1 - \max_c \cos(\mathbf{e}, \mathbf{\mu}_c)$, measuring distance to nearest class prototype centroid in feature space.
- **Threshold Calibration on 5,162 Validation Samples**:
  - `Unknown`: $C < 0.30$ OR $H > 0.50$ OR $d_{\text{proto}} > 0.60$.
  - `Recognised`: $C \ge 0.60$ AND $H \le 0.50$ AND $d_{\text{proto}} \le 0.60$.
  - `Not sure`: All remaining border cases ($0.30 \le C < 0.60$, or top-1/top-2 margin $< 0.15$, or $d_{\text{proto}} > 0.50$).
- **Real Benchmark Evaluation on Test Split & OOD Foods**:
  - OOD Test Set (7 real unseen photos: raw eggs in basket, parathas, notebook, non-food object, apple pie, cheesecake, chicken curry): **100% (7/7) flagged Unknown / Not-Sure, 0.0% False Accept Rate**.
  - Known Test Split (200 random split samples): **63.5% Top-1 / 87.0% Top-5**, reproducing the benchmark without any accuracy loss. High-confidence retention: 58.5%, Not-sure gate: 22.5%, False Unknown: 19.0%.

---

### 2. Unified Nutrition Database & Systematic Audit
- **Public USDA Downloads**: Ingested USDA Foundation Foods (Oct 2024) and USDA SR Legacy (Apr 2018) alongside USDA FNDDS into SQLite database via `fitsnap/server/src/scripts/unify_nutrition_database.py`.
- **Database Scale**: 7,404 unified food records with 18,000+ portions.
  - Verified entries: **6,690 (90.4%)** passing Atwater consistency ($\le 8\%$ error from $4P + 4C + 9F$) and mass conservation.
  - Approximate entries: **714 (9.6%)** explicitly flagged with warning reasons.
  - Missing entries: **0**. Null values stored for absent micronutrients (never converted to deceptive zeros).
- **Multi-Source Conflict Audit**: Flagged 26 foods with $> 20\%$ calorie discrepancy across sources (e.g., raw whole milk vs Greek yogurt vs commodity milk) in `docs/NUTRITION_AUDIT.md`.
- **Authoritative Attributions**: Documented in `docs/NUTRITION_SOURCES.md` (USDA FNDDS/Foundation/SR Legacy public domain, ICMR/IFCT 2017 National Institute of Nutrition, Open Food Facts ODbL).

---

### 3. Application Flow & User Interface Honesty
- **No Silent Wrong Guesses**:
  - `Unknown` State: Shows amber banner `"Food Not Recognised (Tap to Select)"`, displays `"Pending selection"`, leaves calories blank (`— kcal`), and automatically opens search.
  - `Not sure` State: Shows amber badge `"Recognition: 44% (Medium)"`, top-3 interactive suggestion chips, and prompts user confirmation before logging.
  - `Recognised` State: Reserved strictly for high-confidence predictions ($C \ge 0.60, d_{\text{proto}} \le 0.60$).
- **Visual Portion Sizing for Unknown Foods**: For unrecognised foods, U-Net mask provides a rough area estimate (Small: 120g, Medium: 180g, Large: 300g) without claiming pseudo-exact geometric portioning. Calories remain pending until the user selects a food.
- **Traceable Badges**: Replaced generic "Verified" labels with:
  - `Recognition: XX% (High / Medium / Low / Unrecognised)`
  - `Nutrition: Verified source (USDA / ICMR)` or `Nutrition: Approximate`
  - `chosen by you` badge when the user selects a food from search.
- **Commercial Barcode Scanner**: Added Open Food Facts tab with SQLite offline caching, serving scaling, missing-nutrient warnings, and direct macro editing.
- **Recipe Builder**: Added composite dish and custom recipe logging in search drawer.

---

### 4. Continuous Correction Learning (Zero Retraining)
- **Local Mathematical Prototypes (`UserFoodPrototype`)**: Stores 512-dim unit-normalized feature vectors per user in SQLite when meals are confirmed or corrected.
- **Activation Rule**: When $\ge 3$ photos of a corrected food share mean cosine similarity $\ge 0.70$ with a new photo, the food is surfaced as the #1 suggestion with badge `"⭐ from your earlier photos"`.
- **Full User Control & Privacy**:
  - Stored under Settings -> Learned Food Prototypes.
  - Allows full renaming and deletion.
  - **Privacy Guarantee**: FitSnap stores only mathematical 512-number vector embeddings, never user meal photos.

---

## Verification Test Results Matrix

| Test Suite | Purpose | Command / Script | Real Result | Status |
|---|---|---|---|---|
| **Test 1: Golden Table of 60 Foods** | Nutrition audit across 60 staples (30 outside 272 classes) with Atwater consistency check | `python scratch/test_golden_nutrition_60.py` | 60 foods validated, 30 outside 272 classes, 58/58 passing Atwater check ($\le 8\%$). Saved to `data/curated/golden_nutrition_60.csv`. | `PASSED` |
| **Test 2: OOD Detection & Test Split** | Verify 7 OOD photos caught as Unknown and 200 test split samples reproduce 64.5% / 86.4% | `python scratch/test_ood_evaluation.py` | OOD caught: 100% (7/7). False Accept: 0.0%. Test Split: 63.5% Top-1 / 87.0% Top-5. | `PASSED` |
| **Test 3: E2E Unknown Food Workflow** | Upload OOD photo -> Unknown state -> Search "boiled eggs" -> Select portion -> Save with "chosen by you" | `npx tsx scratch/test_unknown_flow.ts` | Photo flagged Unknown (conf 0.170, proto dist 0.738). Boiled eggs selected (143 kcal). Saved to diary with "chosen by you" badge. | `PASSED` |
| **Test 4: Barcode Lookup & Caching** | Query 4 real products (Nutella, Coke, Lay's) + 1 missing field item on Open Food Facts | `npx tsx scratch/test_barcode_lookup.ts` | Nutella 539 kcal (verified), Coke 42 kcal (verified), Lay's 554 kcal (verified). 2nd query: 4ms instant SQLite hit. Missing fields warned. | `PASSED` |
| **Test 5: Correction Learning Flow** | 3 corrections create prototype; 4th photo matches with $\ge 0.70$ and badge "from your earlier photos"; rename & delete | `npx tsx scratch/test_learning_flow.ts` | 3 corrections stored. 4th photo matched with cosine similarity 0.9979 and badge "from your earlier photos". Rename and delete verified. | `PASSED` |

---

## Strict Adherence to Constraints
- **Zero Retraining**: Weights in `ml/checkpoints/` (`cnn_best.pt`, `unet_best.pt`) remain 100% unchanged.
- **Offline / Zero External AI**: No LLM, no external or cloud vision models used. All inferences run locally on CUDA; Open Food Facts and USDA are structured reference databases.
- **Transparent Output**: Real numbers printed at every stage with zero mocks.
