"""
get_all_exact_numbers.py
Calculates and outputs exact numbers for:
1. Dataset split image counts and test images per class
2. Training duration by summing cnn_log.csv time_sec
3. Full test split metrics: test loss, top-1, top-5, macro precision, recall, F1
4. Per-class precision, recall, F1, support sorted worst to best
5. Robustness table with JPEG compression evaluated
"""

import sys
import os
import json
import io
from pathlib import Path
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
RESULTS_DIR = BASE_DIR / "results"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import torch
import torch.nn.functional as F
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
import pandas as pd
import numpy as np

# 1. Dataset stats
with open(DATA_DIR / "train_split.json", "r", encoding="utf-8") as f:
    train_split = json.load(f)
with open(DATA_DIR / "val_split.json", "r", encoding="utf-8") as f:
    val_split = json.load(f)
with open(DATA_DIR / "test_split.json", "r", encoding="utf-8") as f:
    test_split = json.load(f)

import server
server.load_models()
model = server.classifier_model
device = server.DEVICE
temp = server.optimal_temperature

classes = server.CLASS_NAMES
test_counts = Counter(x["class_name"] for x in test_split)

# 2. Training log stats
cnn_df = pd.read_csv(RESULTS_DIR / "cnn_log.csv")
total_time_sec = cnn_df["time_sec"].sum()

# 3. Model inference on full test split
all_targets = []
all_preds = []
all_top5 = []
all_losses = []

for item in test_split:
    c_name = item["class_name"]
    target_idx = item["label"]
    img_path = PROJECT_ROOT / item["path"]

    pil_img = Image.open(img_path).convert("RGB")
    inp = server.eval_transform_cnn(pil_img).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(inp)
        loss = F.cross_entropy(logits, torch.tensor([target_idx]).to(device)).item()
        scaled_logits = logits / max(0.01, temp)
        probs = F.softmax(scaled_logits, dim=-1)[0]
        top5_indices = torch.topk(probs, k=5).indices.tolist()

    pred_idx = top5_indices[0]
    all_targets.append(target_idx)
    all_preds.append(pred_idx)
    all_top5.append(target_idx in top5_indices)
    all_losses.append(loss)

test_loss = np.mean(all_losses)
top1_acc = np.mean([p == t for p, t in zip(all_preds, all_targets)]) * 100
top5_acc = np.mean(all_top5) * 100

report_dict = classification_report(all_targets, all_preds, labels=range(len(classes)), target_names=classes, output_dict=True, zero_division=0)
macro_p = report_dict["macro avg"]["precision"] * 100
macro_r = report_dict["macro avg"]["recall"] * 100
macro_f1 = report_dict["macro avg"]["f1-score"] * 100

# Per class metrics sorted worst to best
per_class = []
for c in classes:
    p = report_dict[c]["precision"] * 100
    r = report_dict[c]["recall"] * 100
    f1 = report_dict[c]["f1-score"] * 100
    supp = int(report_dict[c]["support"])
    per_class.append((c, p, r, f1, supp))

per_class.sort(key=lambda x: (x[3], x[1], x[0]))

# JPEG Robustness check
jpeg_correct = 0
for item in test_split:
    c_name = item["class_name"]
    target_idx = item["label"]
    img_path = PROJECT_ROOT / item["path"]
    pil_img = Image.open(img_path).convert("RGB")

    # Re-compress to JPEG at quality=40
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=40)
    buf.seek(0)
    jpeg_img = Image.open(buf).convert("RGB")
    inp = server.eval_transform_cnn(jpeg_img).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(inp)
        pred = logits.argmax(dim=-1).item()
    if pred == target_idx:
        jpeg_correct += 1
jpeg_acc = (jpeg_correct / len(test_split)) * 100

print(f"TOTAL_CLASSES={len(classes)}")
print(f"TRAIN_COUNT={len(train_split)}")
print(f"VAL_COUNT={len(val_split)}")
print(f"TEST_COUNT={len(test_split)}")
print(f"TOTAL_TIME_SEC={total_time_sec:.1f}")
print(f"TEST_LOSS={test_loss:.4f}")
print(f"TOP1_ACC={top1_acc:.2f}")
print(f"TOP5_ACC={top5_acc:.2f}")
print(f"MACRO_P={macro_p:.2f}")
print(f"MACRO_R={macro_r:.2f}")
print(f"MACRO_F1={macro_f1:.2f}")
print(f"JPEG_ACC={jpeg_acc:.2f}")

print("\n--- PER CLASS METRICS ---")
for c, p, r, f1, supp in per_class:
    print(f"{c}|{p:.1f}|{r:.1f}|{f1:.1f}|{supp}")
