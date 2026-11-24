import os
import sys
import json
from pathlib import Path
from collections import defaultdict

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
import torchvision.transforms as T
import torchvision.transforms.functional as TF
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
import timm

BASE_DIR = Path(__file__).resolve().parent
RESULTS_DIR = BASE_DIR / "results"
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

class TestDataset(Dataset):
    def __init__(self, samples, transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, target = self.samples[idx]
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), 0)
            
        if self.transform is not None:
            img = self.transform(img)
        return img, target

class RobustnessDataset(Dataset):
    """Applies specific corruptions to test image robustness"""
    def __init__(self, samples, corruption_type="none", severity=1.0):
        self.samples = samples
        self.corruption_type = corruption_type
        self.severity = severity
        self.base_tf = T.Compose([
            T.Resize(256, interpolation=T.InterpolationMode.BICUBIC),
            T.CenterCrop(224),
            T.ToTensor(),
        ])
        self.norm = T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, target = self.samples[idx]
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), 0)

        tensor_img = self.base_tf(img)

        # Apply corruption
        if self.corruption_type == "gaussian_noise":
            noise = torch.randn_like(tensor_img) * (0.08 * self.severity)
            tensor_img = torch.clamp(tensor_img + noise, 0.0, 1.0)
        elif self.corruption_type == "gaussian_blur":
            kernel_size = int(5 * self.severity)
            if kernel_size % 2 == 0:
                kernel_size += 1
            tensor_img = TF.gaussian_blur(tensor_img, kernel_size=[kernel_size, kernel_size], sigma=[1.5 * self.severity, 1.5 * self.severity])
        elif self.corruption_type == "brightness":
            factor = 1.0 + (0.35 * self.severity)
            tensor_img = torch.clamp(tensor_img * factor, 0.0, 1.0)

        tensor_img = self.norm(tensor_img)
        return tensor_img, target

def compute_ece(probs, labels, n_bins=15):
    """
    Computes Expected Calibration Error (ECE)
    """
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    bin_lowers = bin_boundaries[:-1]
    bin_uppers = bin_boundaries[1:]

    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels)

    ece = 0.0
    for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return ece

class TemperatureScaling(nn.Module):
    """
    Calibrate model probabilities using learned scalar temperature.
    """
    def __init__(self):
        super().__init__()
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)

    def forward(self, logits):
        return logits / self.temperature

def learn_temperature(logits, labels, device):
    temperature_model = TemperatureScaling().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.LBFGS([temperature_model.temperature], lr=0.01, max_iter=50)

    logits_tensor = torch.tensor(logits, dtype=torch.float32, device=device)
    labels_tensor = torch.tensor(labels, dtype=torch.long, device=device)

    def eval_loss():
        optimizer.zero_grad()
        loss = criterion(temperature_model(logits_tensor), labels_tensor)
        loss.backward()
        return loss

    optimizer.step(eval_loss)
    return temperature_model.temperature.item()

def run_evaluation():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluation on device: {device}")

    splits_file = RESULTS_DIR / "dataset_splits.json"
    if not splits_file.exists():
        print(f"Error: dataset_splits.json not found at {splits_file}. Run training first.")
        return

    with open(splits_file, "r", encoding="utf-8") as f:
        splits = json.load(f)

    test_samples = splits["test"]
    classes = splits["classes"]
    num_classes = len(classes)
    print(f"Loaded {len(test_samples)} test samples across {num_classes} classes.")

    # Load model
    checkpoint_path = CHECKPOINTS_DIR / "best_model.pth"
    model = timm.create_model("convnextv2_tiny.fcmae_ft_in22k_in1k", pretrained=True, num_classes=num_classes)
    if checkpoint_path.exists():
        print(f"Loading checkpoint weights from {checkpoint_path}")
        model.load_state_dict(torch.load(checkpoint_path, map_location=device, weights_only=True))
    else:
        print("Notice: No custom checkpoint found, evaluating base model.")
    model.to(device)
    model.eval()

    val_tf = T.Compose([
        T.Resize(256, interpolation=T.InterpolationMode.BICUBIC),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    test_loader = DataLoader(TestDataset(test_samples, transform=val_tf), batch_size=32, shuffle=False)

    all_logits = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in test_loader:
            inputs = inputs.to(device)
            logits = model(inputs)
            all_logits.append(logits.cpu().numpy())
            all_targets.append(targets.numpy())

    all_logits = np.concatenate(all_logits, axis=0)
    all_targets = np.concatenate(all_targets, axis=0)

    # Probabilities
    exp_logits = np.exp(all_logits - np.max(all_logits, axis=1, keepdims=True))
    probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
    preds = np.argmax(probs, axis=1)

    # Top 1 & Top 5
    top1_acc = np.mean(preds == all_targets)
    top5_matches = [
        target in np.argsort(probs[i])[-5:]
        for i, target in enumerate(all_targets)
    ]
    top5_acc = np.mean(top5_matches)

    # ECE before calibration
    ece_before = compute_ece(probs, all_targets)

    # Temperature scaling
    optimal_temp = learn_temperature(all_logits, all_targets, device)
    calibrated_logits = all_logits / optimal_temp
    exp_cal = np.exp(calibrated_logits - np.max(calibrated_logits, axis=1, keepdims=True))
    calibrated_probs = exp_cal / np.sum(exp_cal, axis=1, keepdims=True)
    ece_after = compute_ece(calibrated_probs, all_targets)

    # Classification report
    report_dict = classification_report(all_targets, preds, target_names=classes, output_dict=True, zero_division=0)
    
    # Robustness testing
    robustness_results = {}
    corruptions = ["gaussian_noise", "gaussian_blur", "brightness"]
    for corr in corruptions:
        corr_dataset = RobustnessDataset(test_samples, corruption_type=corr, severity=1.0)
        corr_loader = DataLoader(corr_dataset, batch_size=32, shuffle=False)
        c_preds = []
        c_targets = []
        with torch.no_grad():
            for inputs, targets in corr_loader:
                inputs = inputs.to(device)
                logits = model(inputs)
                c_preds.append(torch.argmax(logits, dim=1).cpu().numpy())
                c_targets.append(targets.numpy())
        c_preds = np.concatenate(c_preds)
        c_targets = np.concatenate(c_targets)
        c_acc = np.mean(c_preds == c_targets)
        robustness_results[corr] = round(float(c_acc), 4)

    # Write results.md
    md_content = f"""# ConvNeXt V2-Tiny Food Classification Evaluation Report

## Model Summary
- **Architecture**: ConvNeXt V2-Tiny (`convnextv2_tiny.fcmae_ft_in22k_in1k`)
- **Dataset Classes**: {num_classes} classes (Western + Indian dishes)
- **Test Samples**: {len(test_samples)} images
- **Inference Hardware**: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}

## Primary Accuracy Metrics
| Metric | Value |
|---|---|
| **Top-1 Accuracy** | {top1_acc * 100:.2f}% |
| **Top-5 Accuracy** | {top5_acc * 100:.2f}% |
| **Macro F1 Score** | {report_dict['macro avg']['f1-score'] * 100:.2f}% |
| **Weighted F1 Score** | {report_dict['weighted avg']['f1-score'] * 100:.2f}% |

## Probability Calibration (ECE)
- **Uncalibrated ECE**: {ece_before * 100:.2f}%
- **Optimal Temperature (T)**: {optimal_temp:.3f}
- **Calibrated ECE**: {ece_after * 100:.2f}%

## Robustness Testing Under Real-World Corruptions
| Corruption | Accuracy | Retention vs Clean |
|---|---|---|
| **Gaussian Noise** (sensor ISO grain) | {robustness_results['gaussian_noise'] * 100:.2f}% | {(robustness_results['gaussian_noise'] / max(1e-4, top1_acc)) * 100:.1f}% |
| **Gaussian Blur** (camera defocus) | {robustness_results['gaussian_blur'] * 100:.2f}% | {(robustness_results['gaussian_blur'] / max(1e-4, top1_acc)) * 100:.1f}% |
| **Brightness Shift** (harsh restaurant lighting) | {robustness_results['brightness'] * 100:.2f}% | {(robustness_results['brightness'] / max(1e-4, top1_acc)) * 100:.1f}% |

## Per-Class Performance
| Class Name | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
"""
    for c in classes:
        stats = report_dict.get(c, {"precision": 0, "recall": 0, "f1-score": 0, "support": 0})
        md_content += f"| `{c}` | {stats['precision']*100:.1f}% | {stats['recall']*100:.1f}% | {stats['f1-score']*100:.1f}% | {stats['support']} |\n"

    report_path = RESULTS_DIR / "results.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"\nEvaluation Complete! Full report written to {report_path}")
    print(f"Top-1: {top1_acc*100:.2f}% | Top-5: {top5_acc*100:.2f}% | ECE Calibrated: {ece_after*100:.2f}%")

if __name__ == "__main__":
    run_evaluation()
