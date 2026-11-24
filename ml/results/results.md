# FitSnap 272-Class Custom Model Evaluation Report

## Dataset Summary
- **Raw Sources**: `./dataset256` (UEC-FOOD256) + `./Food_Classification` (Indian Staples)
- **Raw Image Count**: 37,068 images across 272 classes
- **Deduplication**: 2,652 duplicates removed (1,973 exact MD5 + 679 pHash Hamming <= 6)
- **Clean Dataset**: 34,416 images across all 272 unified classes (0 classes below 30 images)
- **Split**: 70/15/15 Stratified Split (Seed 42) -> Train: 24,091 | Val: 5,162 | Test: 5,163
- **Cross-Split Leakage**: 0 overlap across all splits (Verified clean)

## Model Architecture & Training Summary
- **Architecture**: Custom ResNet-34 + Squeeze-and-Excitation (SE) + SiLU + Stochastic Depth (DropPath)
- **Total Parameters**: 21.62M weights (21,616,264)
- **Weight Initialization**: Random Kaiming Normal (`use_pretrained=False`, Zero Pretrained Weights)
- **Hardware Platform**: NVIDIA GeForce RTX 4050 Laptop GPU (6.0 GiB GDDR6 VRAM)
- **Training Schedule**: Progressive Resolution (35 epochs @ 128px, 40 epochs @ 176px, 25 epochs @ 224px)
- **Total Training Duration**: 100 Epochs completed

### Sampled Epoch Progression (Every 5 Epochs)

| Epoch | Resolution | Train Loss | Train Acc (%) | Val Loss | Val Acc (%) | Learning Rate | Epoch Time (s) |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 5 | 128px | 5.0102 | 5.71% | 4.6044 | 10.65% | 0.001968 | 395.1s |
| 10 | 128px | 4.4053 | 13.43% | 3.8992 | 23.30% | 0.001936 | 503.6s |
| 15 | 128px | 3.4677 | 30.95% | 3.3423 | 35.51% | 0.001922 | 296.1s |
| 20 | 128px | 3.0399 | 43.36% | 2.9050 | 44.96% | 0.001878 | 292.4s |
| 25 | 128px | 2.6721 | 51.16% | 2.8046 | 47.79% | 0.001807 | 293.6s |
| 30 | 128px | 2.4111 | 58.90% | 2.8440 | 46.47% | 0.001711 | 296.1s |
| 35 | 128px | 2.1660 | 64.49% | 2.8145 | 47.23% | 0.001592 | 294.4s |
| 40 | 176px | 2.4433 | 57.53% | 2.5428 | 54.82% | 0.001569 | 568.8s |
| 45 | 176px | 2.1814 | 64.05% | 2.5509 | 54.01% | 0.001502 | 578.3s |
| 50 | 176px | 2.0618 | 65.67% | 2.5831 | 53.43% | 0.001393 | 585.2s |
| 55 | 176px | 1.9609 | 72.13% | 2.5373 | 54.77% | 0.001305 | 589.9s |
| 60 | 176px | 1.9047 | 71.52% | 2.6986 | 51.05% | 0.001241 | 583.9s |
| 65 | 176px | 1.8149 | 76.82% | 2.7196 | 50.60% | 0.001113 | 576.3s |
| 70 | 176px | 1.8511 | 73.24% | 2.5579 | 55.21% | 0.001057 | 483.4s |
| 75 | 176px | 1.8222 | 74.76% | 2.4679 | 57.48% | 0.000931 | 501.6s |
| 80 | 224px | 1.9774 | 69.85% | 2.1800 | 64.84% | 0.000843 | 724.2s |
| 85 | 224px | 1.8376 | 74.44% | 2.1108 | 66.68% | 0.000612 | 700.6s |
| 90 | 224px | 1.7040 | 77.22% | 2.0491 | 68.66% | 0.000326 | 704.1s |
| 95 | 224px | 1.6634 | 77.14% | 2.0189 | 69.59% | 0.000097 | 707.4s |
| 99 | 224px | 1.6150 | 80.59% | 2.0183 | 70.50% | 0.000013 | 712.5s |
| 100 | 224px | 1.6791 | 77.72% | 2.0174 | 69.90% | 0.000010 | 699.4s |

## 1. Test Split Accuracy & Comprehensive Metrics

| Metric | Value |
|---|---|
| **Test Top-1 Accuracy** | **64.54%** (95% CI: [63.23%, 65.84%]) |
| **Test Top-5 Accuracy** | **86.35%** |
| **Test Loss** | **1.6658** |
| **Macro Precision** | 64.57% |
| **Macro Recall** | 62.66% |
| **Macro F1-Score** | 62.01% |
| **Weighted F1-Score** | 64.19% |
| **GPU Latency** | 0.74 ms/image |
| **Pre-Calibration ECE** | 16.53% |
| **Optimal Temperature (T)** | 0.751 |
| **Post-Calibration ECE** | 2.83% |

## 2. Robustness Stress Tests & Adversarial Evaluation (200 Test Images)

| Condition | Accuracy | Drop vs Clean |
|---|:---:|:---:|
| Clean Baseline (200 images) | 62.50% | +0.00% |
| Gaussian Noise (std=0.15) | 60.00% | -2.50% |
| Low Light (0.5x brightness) | 52.00% | -10.50% |
| Gaussian Blur (k=5) | 47.00% | -15.50% |
| JPEG Compression (Simulated) | 63.50% | +1.00% |
| FGSM (eps=2/255) | 23.50% | -39.00% |
| FGSM (eps=8/255) | 1.00% | -61.50% |

## 3. Top 30 Most Confused Class Pairs

| Rank | True Class | Misclassified As | Count |
|---|---|---|---|
| 1 | `egg_noodle_in_chicken_yellow_curry` | `khao_soi` | 11 |
| 2 | `fried_rice` | `nasi_goreng` | 7 |
| 3 | `fried_rice` | `pilaf` | 7 |
| 4 | `kaathi_rolls` | `chapati` | 6 |
| 5 | `ramen_noodle` | `beef_noodle` | 6 |
| 6 | `barbecued_red_pork_in_sauce_with_rice` | `rice_crispy_pork` | 5 |
| 7 | `chicken_cutlet` | `pork_fillet_cutlet` | 5 |
| 8 | `chicken_cutlet` | `pork_loin_cutlet` | 5 |
| 9 | `cutlet_curry` | `pork_loin_cutlet` | 5 |
| 10 | `deep_fried_chicken_wing` | `ayam_goreng` | 5 |
| 11 | `eels_on_rice` | `broiled_eel_bowl` | 5 |
| 12 | `samosa` | `curry_puff` | 5 |
| 13 | `bagel` | `roll_bread` | 4 |
| 14 | `cutlet_curry` | `beef_curry` | 4 |
| 15 | `egg_sunny_side_up` | `loco_moco` | 4 |
| 16 | `ham_cutlet` | `pork_fillet_cutlet` | 4 |
| 17 | `japanese_tofu_and_vegetable_chowder` | `pork_miso_soup` | 4 |
| 18 | `khao_soi` | `egg_noodle_in_chicken_yellow_curry` | 4 |
| 19 | `lasagna` | `pizza` | 4 |
| 20 | `miso_soup` | `pork_cutlet_on_rice` | 4 |
| 21 | `momos` | `fried_pork_dumplings_served_in_soup` | 4 |
| 22 | `nasi_padang` | `nasi_campur` | 4 |
| 23 | `omelet_with_fried_rice` | `omelet` | 4 |
| 24 | `pizza_toast` | `pizza` | 4 |
| 25 | `pork_miso_soup` | `miso_soup` | 4 |
| 26 | `rice_crispy_pork` | `barbecued_red_pork_in_sauce_with_rice` | 4 |
| 27 | `vegetable_tempura` | `tempura` | 4 |
| 28 | `xiao_long_bao` | `fried_pork_dumplings_served_in_soup` | 4 |
| 29 | `ayam_goreng` | `pakode` | 3 |
| 30 | `baked_salmon` | `pizza` | 3 |

## 4. Per-Class Performance (Worst 30 Classes by F1)

| Rank | Class Name | Precision | Recall | F1-Score | Test Images |
|---|---|:---:|:---:|:---:|:---:|
| 1 | `fried_fish` | 33.3% | 6.7% | 11.1% | 15 |
| 2 | `chicken_cutlet` | 13.3% | 11.8% | 12.5% | 17 |
| 3 | `noodles_with_fish_curry` | 28.6% | 14.3% | 19.0% | 14 |
| 4 | `yellow_curry` | 21.4% | 20.0% | 20.7% | 15 |
| 5 | `pork_cutlet` | 66.7% | 13.3% | 22.2% | 15 |
| 6 | `rice_crispy_pork` | 30.8% | 22.2% | 25.8% | 18 |
| 7 | `fried_spring_rolls` | 28.6% | 26.7% | 27.6% | 15 |
| 8 | `pork_fillet_cutlet` | 21.1% | 47.1% | 29.1% | 17 |
| 9 | `egg_noodle_in_chicken_yellow_curry` | 40.0% | 23.5% | 29.6% | 17 |
| 10 | `ayam_goreng` | 25.0% | 40.0% | 30.8% | 15 |
| 11 | `vegetable_tempura` | 44.4% | 25.0% | 32.0% | 16 |
| 12 | `beef_in_oyster_sauce` | 40.0% | 26.7% | 32.0% | 15 |
| 13 | `japanese_tofu_and_vegetable_chowder` | 50.0% | 25.0% | 33.3% | 12 |
| 14 | `grilled_eggplant` | 40.0% | 28.6% | 33.3% | 14 |
| 15 | `baked_salmon` | 38.5% | 31.2% | 34.5% | 16 |
| 16 | `sausage` | 66.7% | 23.5% | 34.8% | 17 |
| 17 | `crispy_noodles` | 44.4% | 28.6% | 34.8% | 14 |
| 18 | `crape` | 38.5% | 33.3% | 35.7% | 15 |
| 19 | `minced_meat_cutlet` | 45.5% | 33.3% | 38.5% | 15 |
| 20 | `pork_belly` | 45.5% | 33.3% | 38.5% | 15 |
| 21 | `ham_cutlet` | 36.8% | 41.2% | 38.9% | 17 |
| 22 | `butter_naan` | 50.0% | 33.3% | 40.0% | 6 |
| 23 | `khao_soi` | 33.3% | 50.0% | 40.0% | 18 |
| 24 | `tanmen` | 50.0% | 35.3% | 41.4% | 17 |
| 25 | `meat_loaf` | 71.4% | 29.4% | 41.7% | 17 |
| 26 | `mie_goreng` | 50.0% | 35.7% | 41.7% | 14 |
| 27 | `deep_fried_chicken_wing` | 43.8% | 41.2% | 42.4% | 17 |
| 28 | `chip_butty` | 85.7% | 28.6% | 42.9% | 21 |
| 29 | `jambalaya` | 50.0% | 37.5% | 42.9% | 16 |
| 30 | `pork_miso_soup` | 40.0% | 46.2% | 42.9% | 13 |

## 5. Per-Class Performance (Top 10 Classes by F1)

| Rank | Class Name | Precision | Recall | F1-Score | Test Images |
|---|---|:---:|:---:|:---:|:---:|
| 1 | `laulau` | 88.2% | 100.0% | 93.8% | 15 |
| 2 | `tensin_noodle` | 93.8% | 93.8% | 93.8% | 16 |
| 3 | `soba_noodle` | 84.6% | 100.0% | 91.7% | 22 |
| 4 | `chole_bhature` | 87.7% | 93.4% | 90.5% | 61 |
| 5 | `jalebi` | 90.7% | 88.6% | 89.7% | 44 |
| 6 | `custard_tart` | 92.9% | 86.7% | 89.7% | 15 |
| 7 | `okinawa_soba` | 100.0% | 81.2% | 89.7% | 16 |
| 8 | `tiramisu` | 78.9% | 100.0% | 88.2% | 15 |
| 9 | `minced_pork_rice` | 88.2% | 88.2% | 88.2% | 17 |
| 10 | `dhokla` | 94.6% | 81.4% | 87.5% | 43 |


# FitSnap U-Net Segmentation Evaluation (Part 4)

**Architecture**: 4-Level U-Net with Skip Connections (Channels: 32 -> 64 -> 128 -> 256 -> 512, 7.76M parameters)  
**Supervision**: **Trained on weak masks** (Classical OpenCV GrabCut + Hough Circle plate detection)  
**Hardware**: NVIDIA GeForce RTX 4050 Laptop GPU (AMP autocast)  

| Metric | Result | Notes |
|---|:---:|---|
| **Mean IoU (Test)** | **67.76%** | Labeled: evaluated against weak pseudo-masks |
| **Dice Coefficient (Test)** | **77.32%** | Labeled: evaluated against weak pseudo-masks |
| **Loss Function** | **BCE + Dice Composite** | 0.5 BCE + 0.5 Dice |
| **Sample Overlays** | **20 PNGs** | Saved to `ml/results/unet_overlays/` |
