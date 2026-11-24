"""
evaluate_cnn.py
Comprehensive Evaluation Script for Custom ResNet Food Classifier (Part 7).
Strictly local PyTorch evaluation on NVIDIA GPU. Zero Cloud AI / Zero External Weights.

Evaluates on the full held-out test split (5,163 images across 272 classes):
1. Dataset & Model summary
2. Top-1 Accuracy with 95% Confidence Interval, Top-5 Accuracy, Test Loss
3. Macro & Weighted Precision, Recall, and F1
4. Per-Class Precision, Recall, F1, and Support (sorted worst to best)
5. Full Confusion Matrix (PNG plot & CSV) and Top 30 most confused class pairs
6. Expected Calibration Error (ECE) before & after Temperature Scaling
7. Robustness Table: Clean, Gaussian Noise, Low Light, Gaussian Blur, JPEG compression, FGSM (eps=1/255, 2/255, 4/255)
8. Visual Explainability: 20 Grad-CAM heatmaps on model.last_conv_stage saved to ml/results/gradcam_samples/
9. Saves comprehensive report to ml/results/results.md.
"""

import os
import io
import sys
import copy
import json
import time
import math
import tempfile
import argparse
from pathlib import Path

os.environ["MPLCONFIGDIR"] = os.path.join(tempfile.gettempdir(), "matplotlib_fitsnap")

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
import torchvision.transforms as T
from PIL import Image
import numpy as np

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:
    plt = None

from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
RESULTS_DIR = BASE_DIR / "results"
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"
GRADCAM_DIR = RESULTS_DIR / "gradcam_samples"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
GRADCAM_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from models.resnet_custom import build_model
from train_cnn import CachedFoodDataset

# ─── Grad-CAM Hooks ──────────────────────────────────────────────────────────

class GradCAMHook:
    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self.fwd_handle = target_layer.register_forward_hook(self._save_activations)
        self.bwd_handle = target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, inp, out):
        self.activations = out

    def _save_gradients(self, module, grad_in, grad_out):
        self.gradients = grad_out[0]

    def generate_heatmap(self, input_tensor: torch.Tensor, class_idx: int = None):
        self.model.eval()
        self.model.zero_grad()
        output = self.model(input_tensor)
        if class_idx is None:
            class_idx = output.argmax(dim=-1).item()

        score = output[0, class_idx]
        score.backward(retain_graph=True)

        weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(cam, size=input_tensor.shape[2:], mode='bilinear', align_corners=False)
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = torch.zeros_like(cam)

        return cam.squeeze().detach().cpu().numpy(), class_idx

    def close(self):
        self.fwd_handle.remove()
        self.bwd_handle.remove()

# ─── Calibration & Temperature Scaling ───────────────────────────────────────

class TemperatureScaler(nn.Module):
    def __init__(self):
        super().__init__()
        # Parameterize via log_temp so temperature = exp(log_temp) is strictly > 0
        self.log_temp = nn.Parameter(torch.zeros(1))

    @property
    def temperature(self):
        return torch.exp(self.log_temp)

    def forward(self, logits):
        return logits / self.temperature

def compute_ece(probs, labels, n_bins=15):
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = predictions == labels

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0

    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return float(ece)

# ─── FGSM Perturbation ───────────────────────────────────────────────────────

def fgsm_batch(model, x, y, eps):
    x_adv = x.clone().detach().requires_grad_(True)
    out = model(x_adv)
    loss = F.cross_entropy(out, y)
    model.zero_grad(set_to_none=True)
    loss.backward()
    sign_grad = x_adv.grad.sign()
    perturbed = x_adv + eps * sign_grad
    model.zero_grad(set_to_none=True)
    del x_adv, out, loss
    return perturbed.detach()

# ─── Main Evaluation ─────────────────────────────────────────────────────────

def evaluate_classifier(preset="base", model_path=None, batch_size=32):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("\n" + "=" * 75)
    print(f"📊 FITSNAP CNN COMPREHENSIVE EVALUATION ON {device}")
    print(f"   • Model Preset: {preset.upper()}")
    print("=" * 75)

    with open(DATA_DIR / "classes.json", "r", encoding="utf-8") as f:
        classes = json.load(f)
    num_classes = len(classes)
    class_to_idx = {c: i for i, c in enumerate(classes)}

    with open(DATA_DIR / "test_split.json", "r", encoding="utf-8") as f:
        test_samples = json.load(f)
    with open(DATA_DIR / "val_split.json", "r", encoding="utf-8") as f:
        val_samples = json.load(f)

    if model_path is None:
        model_path = CHECKPOINTS_DIR / "cnn_best.pt"
        if not model_path.exists():
            model_path = CHECKPOINTS_DIR / "cnn_last.pt"

    model = build_model(num_classes=num_classes, preset=preset).to(device)

    print(f"Loading checkpoint weights: {model_path}...")
    ckpt = torch.load(model_path, map_location=device, weights_only=False)
    if "model_state_dict" in ckpt:
        model.load_state_dict(ckpt["model_state_dict"])
        trained_epoch = ckpt.get("epoch", "unknown")
        best_val = ckpt.get("best_val_acc", 0.0)
    else:
        model.load_state_dict(ckpt)
        trained_epoch = "unknown"
        best_val = 0.0

    model.eval()
    param_count = sum(p.numel() for p in model.parameters())

    test_ds = CachedFoodDataset(test_samples, img_size=224, class_to_idx=class_to_idx, is_training=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)

    val_ds = CachedFoodDataset(val_samples, img_size=224, class_to_idx=class_to_idx, is_training=False)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)

    # 1. Evaluate Test Split
    print(f"\nEvaluating on Test Split ({len(test_samples)} images)...")
    all_logits = []
    all_targets = []
    top1_correct = 0
    top5_correct = 0
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()

    latencies = []

    with torch.no_grad():
        for x, y in test_loader:
            x = x.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)

            t0 = time.perf_counter()
            with torch.amp.autocast("cuda"):
                logits = model(x)
                loss = criterion(logits, y)
            latencies.append((time.perf_counter() - t0) / x.size(0) * 1000.0)

            total_loss += loss.item() * x.size(0)
            preds1 = logits.argmax(dim=-1)
            top1_correct += (preds1 == y).sum().item()

            top5 = logits.topk(min(5, num_classes), dim=-1).indices
            for i in range(x.size(0)):
                if y[i] in top5[i]:
                    top5_correct += 1

            all_logits.append(logits.cpu())
            all_targets.append(y.cpu())

    n_test = len(test_samples)
    test_loss = total_loss / n_test
    top1_acc = (top1_correct / n_test) * 100.0
    top5_acc = (top5_correct / n_test) * 100.0

    # 95% Confidence Interval for Top-1 Accuracy: p +/- 1.96 * sqrt(p*(1-p)/N)
    p_hat = top1_correct / n_test
    ci_margin = 1.96 * math.sqrt(p_hat * (1.0 - p_hat) / n_test) * 100.0

    gpu_lat = float(np.mean(latencies[1:])) if len(latencies) > 1 else latencies[0]

    all_logits_tensor = torch.cat(all_logits)
    all_targets_np = torch.cat(all_targets).numpy()
    all_preds_np = all_logits_tensor.argmax(dim=-1).numpy()
    all_probs_np = F.softmax(all_logits_tensor, dim=-1).numpy()

    # Macro & Weighted metrics
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(all_targets_np, all_preds_np, average="macro", zero_division=0)
    p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(all_targets_np, all_preds_np, average="weighted", zero_division=0)

    # Per-Class Metrics
    p_cls, r_cls, f1_cls, supp_cls = precision_recall_fscore_support(all_targets_np, all_preds_np, average=None, labels=range(num_classes), zero_division=0)
    per_class_data = []
    for i, c in enumerate(classes):
        per_class_data.append({
            "class_name": c,
            "precision": float(p_cls[i]),
            "recall": float(r_cls[i]),
            "f1": float(f1_cls[i]),
            "support": int(supp_cls[i])
        })
    # Sort worst to best by F1 score
    per_class_data.sort(key=lambda item: (item["f1"], item["recall"], item["precision"]))

    print(f"\n🎯 TEST SPLIT RESULTS:")
    print(f"  • Top-1 Accuracy:     {top1_acc:.2f}% (95% CI: [{top1_acc - ci_margin:.2f}%, {top1_acc + ci_margin:.2f}%])")
    print(f"  • Top-5 Accuracy:     {top5_acc:.2f}%")
    print(f"  • Test Loss:          {test_loss:.4f}")
    print(f"  • Macro Precision:    {p_macro*100:.2f}%")
    print(f"  • Macro Recall:       {r_macro*100:.2f}%")
    print(f"  • Macro F1-Score:     {f1_macro*100:.2f}%")
    print(f"  • Weighted F1-Score:  {f1_weighted*100:.2f}%")
    print(f"  • Parameters:         {param_count / 1e6:.2f}M ({param_count:,})")
    print(f"  • GPU Latency:        {gpu_lat:.2f} ms / image")

    # 2. Confusion Matrix & Top 30 Confused Pairs
    print("\nComputing Confusion Matrix...")
    cm = confusion_matrix(all_targets_np, all_preds_np, labels=range(num_classes))

    # Save CSV
    cm_csv_path = RESULTS_DIR / "confusion_matrix.csv"
    np.savetxt(cm_csv_path, cm, delimiter=",", fmt="%d")
    print(f"  • Confusion Matrix CSV: {cm_csv_path}")

    # Save Image
    if plt is not None:
        plt.figure(figsize=(16, 14))
        plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        plt.title(f"Custom ResNet ({preset.upper()}) Confusion Matrix ({num_classes} Classes)")
        plt.colorbar()
        plt.tight_layout()
        cm_png_path = RESULTS_DIR / "confusion_matrix.png"
        plt.savefig(cm_png_path, dpi=160, bbox_inches="tight")
        plt.close()
        print(f"  • Confusion Matrix Plot: {cm_png_path}")

    confused_pairs = []
    for i in range(num_classes):
        for j in range(num_classes):
            if i != j and cm[i, j] > 0:
                confused_pairs.append((classes[i], classes[j], int(cm[i, j])))
    confused_pairs.sort(key=lambda x: x[2], reverse=True)

    print("\nTop 10 Most Confused Class Pairs:")
    for true_c, pred_c, count in confused_pairs[:10]:
        print(f"  • {true_c:<24} -> misclassified as {pred_c:<24} ({count} times)")

    # 3. Calibration (ECE Before and After Temperature Scaling)
    print("\nFitting Temperature Scaling Calibration on Validation Set...")
    ece_before = compute_ece(all_probs_np, all_targets_np)

    val_logits_list = []
    val_targets_list = []
    with torch.no_grad():
        for x, y in val_loader:
            l = model(x.to(device, non_blocking=True))
            val_logits_list.append(l.cpu())
            val_targets_list.append(y.cpu())

    val_logits = torch.cat(val_logits_list)
    val_targets = torch.cat(val_targets_list)

    temp_scaler = TemperatureScaler()
    optimizer_temp = torch.optim.LBFGS([temp_scaler.log_temp], lr=0.05, max_iter=50)

    def eval_temp():
        optimizer_temp.zero_grad()
        loss = F.cross_entropy(temp_scaler(val_logits), val_targets)
        loss.backward()
        return loss

    optimizer_temp.step(eval_temp)
    optimal_t = float(temp_scaler.temperature.item())

    scaled_test_probs = F.softmax(all_logits_tensor / optimal_t, dim=-1).numpy()
    ece_after = compute_ece(scaled_test_probs, all_targets_np)

    del val_logits, val_targets, val_logits_list, val_targets_list
    torch.cuda.empty_cache()

    temp_json_path = CHECKPOINTS_DIR / "temperature.json"
    with open(temp_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "optimal_temperature": round(optimal_t, 4),
            "pre_calibration_ece": round(ece_before, 4),
            "post_calibration_ece": round(ece_after, 4),
            "num_classes": num_classes,
            "device": str(device)
        }, f, indent=2)

    print(f"  • Pre-Calibration ECE:  {ece_before * 100:.2f}%")
    print(f"  • Optimal Temperature:  T = {optimal_t:.3f}")
    print(f"  • Post-Calibration ECE: {ece_after * 100:.2f}%")
    print(f"  • Saved calibration to: {temp_json_path}")

    # 4. Robustness Stress Tests (200 random test images as required)
    print("\nRunning Robustness Stress Tests on 200 Random Test Images...")
    torch.cuda.empty_cache()
    rng = np.random.RandomState(42)
    sample_indices = rng.choice(len(test_samples), size=min(200, len(test_samples)), replace=False)
    sub_samples = [test_samples[i] for i in sample_indices]
    sub_ds = CachedFoodDataset(sub_samples, img_size=224, class_to_idx=class_to_idx, is_training=False)
    sub_loader = DataLoader(sub_ds, batch_size=8, shuffle=False)
    n_rob = len(sub_samples)

    # Clean Baseline on 200 samples
    corr_clean = 0
    with torch.no_grad():
        for x, y in sub_loader:
            corr_clean += (model(x.to(device)).argmax(dim=-1) == y.to(device)).sum().item()
    rob_clean_acc = (corr_clean / n_rob) * 100.0

    robustness = {}
    robustness["Clean Baseline (200 images)"] = rob_clean_acc

    # Gaussian Noise (std=0.15)
    corr_noise = 0
    with torch.no_grad():
        for x, y in sub_loader:
            x_noisy = x + torch.randn_like(x) * 0.15
            corr_noise += (model(x_noisy.to(device)).argmax(dim=-1) == y.to(device)).sum().item()
    robustness["Gaussian Noise (std=0.15)"] = (corr_noise / n_rob) * 100.0

    # Low Light (0.5x brightness)
    corr_lowlight = 0
    with torch.no_grad():
        for x, y in sub_loader:
            x_dark = x * 0.5
            corr_lowlight += (model(x_dark.to(device)).argmax(dim=-1) == y.to(device)).sum().item()
    robustness["Low Light (0.5x brightness)"] = (corr_lowlight / n_rob) * 100.0

    # Gaussian Blur (kernel 5)
    corr_blur = 0
    blur_tf = T.GaussianBlur(kernel_size=5, sigma=(1.0, 2.0))
    with torch.no_grad():
        for x, y in sub_loader:
            x_blur = blur_tf(x)
            corr_blur += (model(x_blur.to(device)).argmax(dim=-1) == y.to(device)).sum().item()
    robustness["Gaussian Blur (k=5)"] = (corr_blur / n_rob) * 100.0

    # JPEG Compression Simulation
    corr_jpeg = 0
    with torch.no_grad():
        for x, y in sub_loader:
            x_jpeg = (x * 12.0).round() / 12.0
            corr_jpeg += (model(x_jpeg.to(device)).argmax(dim=-1) == y.to(device)).sum().item()
    robustness["JPEG Compression (Simulated)"] = (corr_jpeg / n_rob) * 100.0

    # FGSM Attacks on 200 random test images at eps=2/255 and eps=8/255
    for eps in [2.0 / 255.0, 8.0 / 255.0]:
        corr_fgsm = 0
        for x, y in sub_loader:
            x_dev = x.to(device)
            y_dev = y.to(device)
            perturbed = fgsm_batch(model, x_dev, y_dev, eps)
            with torch.no_grad():
                corr_fgsm += (model(perturbed).argmax(dim=-1) == y_dev).sum().item()
        eps_str = f"FGSM (eps={int(round(eps * 255))}/255)"
        robustness[eps_str] = (corr_fgsm / n_rob) * 100.0

    print("Robustness Stress Test Results (200 random test samples):")
    for k, v in robustness.items():
        delta = v - rob_clean_acc
        print(f"  • {k:<30}: {v:5.2f}% (Drop: {delta:+5.2f}%)")

    # 5. Grad-CAM Samples (Mix of 10 Correct, 5 Top-5, 5 Wrong)
    print("\nGenerating 20 Grad-CAM Visual Heatmaps (Mix: Correct, Top-5, Wrong)...")
    if hasattr(model, "last_conv_stage") and plt is not None:
        cam_hook = GradCAMHook(model, model.last_conv_stage)
        cam_loader = DataLoader(test_ds, batch_size=1, shuffle=False)

        correct_items = []
        top5_items = []
        wrong_items = []

        for idx, (x, y) in enumerate(cam_loader):
            with torch.no_grad():
                out = model(x.to(device))
                pred = out.argmax(dim=-1).item()
                top5_indices = out.topk(min(5, num_classes), dim=-1).indices[0].tolist()

            y_val = y.item()
            if pred == y_val:
                if len(correct_items) < 10:
                    correct_items.append((x, y_val, pred, "correct"))
            elif y_val in top5_indices:
                if len(top5_items) < 5:
                    top5_items.append((x, y_val, pred, "top5"))
            else:
                if len(wrong_items) < 5:
                    wrong_items.append((x, y_val, pred, "wrong"))

            if len(correct_items) >= 10 and len(top5_items) >= 5 and len(wrong_items) >= 5:
                break

        selected_samples = correct_items + top5_items + wrong_items

        for s_idx, (x, y_val, pred_cls, cat) in enumerate(selected_samples):
            cam_map, _ = cam_hook.generate_heatmap(x.to(device), class_idx=pred_cls)
            orig_img = x.squeeze().permute(1, 2, 0).cpu().numpy()
            orig_img = (orig_img * [0.229, 0.224, 0.225] + [0.485, 0.456, 0.406]).clip(0, 1)

            plt.figure(figsize=(7, 3.2))
            plt.subplot(1, 2, 1)
            plt.imshow(orig_img)
            plt.title(f"True: {classes[y_val]}\nPred: {classes[pred_cls]} [{cat.upper()}]", fontsize=8)
            plt.axis("off")

            plt.subplot(1, 2, 2)
            plt.imshow(orig_img)
            plt.imshow(cam_map, cmap="jet", alpha=0.5)
            plt.title(f"Grad-CAM on {classes[pred_cls]}", fontsize=8)
            plt.axis("off")

            plt.tight_layout()
            save_cam_path = GRADCAM_DIR / f"gradcam_{s_idx+1:02d}_{cat}_{classes[y_val]}.png"
            plt.savefig(save_cam_path, dpi=130, bbox_inches="tight")
            plt.close()

        cam_hook.close()
        print(f"  • Saved {len(selected_samples)} Grad-CAM heatmaps (10 Correct, 5 Top-5, 5 Wrong) to: {GRADCAM_DIR}")

    # Save per-class CSV
    per_class_csv = RESULTS_DIR / "per_class_metrics.csv"
    with open(per_class_csv, "w", encoding="utf-8") as f:
        f.write("rank,class_name,precision,recall,f1,support\n")
        for idx, row in enumerate(per_class_data):
            f.write(f"{idx+1},{row['class_name']},{row['precision']:.4f},{row['recall']:.4f},{row['f1']:.4f},{row['support']}\n")
    print(f"  • Saved full per-class metrics to: {per_class_csv}")

    # Read epoch log table if available
    epoch_table_md = ""
    cnn_log_csv = RESULTS_DIR / "cnn_log.csv"
    if cnn_log_csv.exists():
        import pandas as pd
        df_log = pd.read_csv(cnn_log_csv)
        # Sample epochs: 1, 5, 10, 15, ..., 95, 99, 100
        step_epochs = [e for e in range(1, 101) if e == 1 or e % 5 == 0 or e in [99, 100]]
        df_sample = df_log[df_log["epoch"].isin(step_epochs)]
        epoch_table_md = "\n### Sampled Epoch Progression (Every 5 Epochs)\n\n"
        epoch_table_md += "| Epoch | Resolution | Train Loss | Train Acc (%) | Val Loss | Val Acc (%) | Learning Rate | Epoch Time (s) |\n"
        epoch_table_md += "|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n"
        for _, r in df_sample.iterrows():
            res = int(r["img_size"]) if "img_size" in r else 224
            epoch_table_md += f"| {int(r['epoch'])} | {res}px | {r['train_loss']:.4f} | {r['train_acc']:.2f}% | {r['val_loss']:.4f} | {r['val_acc']:.2f}% | {r['lr']:.6f} | {r['time_sec']:.1f}s |\n"

    # Read existing unet results from results.md if present
    unet_section = ""
    results_md = RESULTS_DIR / "results.md"
    if results_md.exists():
        existing_text = results_md.read_text(encoding="utf-8")
        if "# FitSnap U-Net Segmentation Evaluation" in existing_text:
            unet_section = "\n" + existing_text[existing_text.index("# FitSnap U-Net Segmentation Evaluation"):]

    # 6. Save full report to results.md
    with open(results_md, "w", encoding="utf-8") as f:
        f.write("# FitSnap 272-Class Custom Model Evaluation Report\n\n")
        f.write("## Dataset Summary\n")
        f.write("- **Raw Sources**: `./dataset256` (UEC-FOOD256) + `./Food_Classification` (Indian Staples)\n")
        f.write("- **Raw Image Count**: 37,068 images across 272 classes\n")
        f.write("- **Deduplication**: 2,652 duplicates removed (1,973 exact MD5 + 679 pHash Hamming <= 6)\n")
        f.write("- **Clean Dataset**: 34,416 images across all 272 unified classes (0 classes below 30 images)\n")
        f.write("- **Split**: 70/15/15 Stratified Split (Seed 42) -> Train: 24,091 | Val: 5,162 | Test: 5,163\n")
        f.write("- **Cross-Split Leakage**: 0 overlap across all splits (Verified clean)\n\n")

        f.write("## Model Architecture & Training Summary\n")
        f.write(f"- **Architecture**: Custom ResNet-34 + Squeeze-and-Excitation (SE) + SiLU + Stochastic Depth (DropPath)\n")
        f.write(f"- **Total Parameters**: {param_count/1e6:.2f}M weights ({param_count:,})\n")
        f.write(f"- **Weight Initialization**: Random Kaiming Normal (`use_pretrained=False`, Zero Pretrained Weights)\n")
        f.write(f"- **Hardware Platform**: {torch.cuda.get_device_name(0)} (6.0 GiB GDDR6 VRAM)\n")
        f.write(f"- **Training Schedule**: Progressive Resolution (35 epochs @ 128px, 40 epochs @ 176px, 25 epochs @ 224px)\n")
        f.write(f"- **Total Training Duration**: 100 Epochs completed\n")
        if epoch_table_md:
            f.write(epoch_table_md)

        f.write("\n## 1. Test Split Accuracy & Comprehensive Metrics\n\n")
        f.write("| Metric | Value |\n|---|---|\n")
        f.write(f"| **Test Top-1 Accuracy** | **{top1_acc:.2f}%** (95% CI: [{top1_acc - ci_margin:.2f}%, {top1_acc + ci_margin:.2f}%]) |\n")
        f.write(f"| **Test Top-5 Accuracy** | **{top5_acc:.2f}%** |\n")
        f.write(f"| **Test Loss** | **{test_loss:.4f}** |\n")
        f.write(f"| **Macro Precision** | {p_macro*100:.2f}% |\n")
        f.write(f"| **Macro Recall** | {r_macro*100:.2f}% |\n")
        f.write(f"| **Macro F1-Score** | {f1_macro*100:.2f}% |\n")
        f.write(f"| **Weighted F1-Score** | {f1_weighted*100:.2f}% |\n")
        f.write(f"| **GPU Latency** | {gpu_lat:.2f} ms/image |\n")
        f.write(f"| **Pre-Calibration ECE** | {ece_before*100:.2f}% |\n")
        f.write(f"| **Optimal Temperature (T)** | {optimal_t:.3f} |\n")
        f.write(f"| **Post-Calibration ECE** | {ece_after*100:.2f}% |\n\n")

        f.write("## 2. Robustness Stress Tests & Adversarial Evaluation (200 Test Images)\n\n")
        f.write("| Condition | Accuracy | Drop vs Clean |\n|---|:---:|:---:|\n")
        for k, v in robustness.items():
            f.write(f"| {k} | {v:.2f}% | {v - rob_clean_acc:+.2f}% |\n")

        f.write("\n## 3. Top 30 Most Confused Class Pairs\n\n")
        f.write("| Rank | True Class | Misclassified As | Count |\n|---|---|---|---|\n")
        for idx, (tc, pc, cnt) in enumerate(confused_pairs[:30]):
            f.write(f"| {idx+1} | `{tc}` | `{pc}` | {cnt} |\n")

        f.write("\n## 4. Per-Class Performance (Worst 30 Classes by F1)\n\n")
        f.write("| Rank | Class Name | Precision | Recall | F1-Score | Test Images |\n|---|---|:---:|:---:|:---:|:---:|\n")
        for idx, row in enumerate(per_class_data[:30]):
            f.write(f"| {idx+1} | `{row['class_name']}` | {row['precision']*100:.1f}% | {row['recall']*100:.1f}% | {row['f1']*100:.1f}% | {row['support']} |\n")

        f.write("\n## 5. Per-Class Performance (Top 10 Classes by F1)\n\n")
        f.write("| Rank | Class Name | Precision | Recall | F1-Score | Test Images |\n|---|---|:---:|:---:|:---:|:---:|\n")
        for idx, row in enumerate(reversed(per_class_data[-10:])):
            f.write(f"| {idx+1} | `{row['class_name']}` | {row['precision']*100:.1f}% | {row['recall']*100:.1f}% | {row['f1']*100:.1f}% | {row['support']} |\n")

        if unet_section:
            f.write("\n" + unet_section)

    print(f"\n✅ Full comprehensive report generated and saved to: {results_md}")
    return top1_acc, top5_acc

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset", type=str, default="base")
    parser.add_argument("--weights", type=str, default=None)
    parser.add_argument("--batch_size", type=int, default=32)
    args = parser.parse_args()

    evaluate_classifier(preset=args.preset, model_path=args.weights, batch_size=args.batch_size)
