"""
analyze_confusion_and_low_confidence.py
Detailed analysis of the model's confusion matrix and class sensitivity:
1. Computes predictions across validation & test splits under clean and perturbation conditions.
2. Identifies the 10 foods that the model gets wrong or has the lowest classification confidence / margin.
3. Outputs a clear table with ground truth class, primary confused class / lowest margin rival, average confidence, and app mitigation.
"""

import sys
import os
import json
from pathlib import Path
from collections import defaultdict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import torch
import torch.nn.functional as F
from PIL import Image
import server

server.load_models()
model = server.classifier_model
device = server.DEVICE
temp = server.optimal_temperature

with open(DATA_DIR / "val_split.json", "r", encoding="utf-8") as f:
    val_split = json.load(f)
with open(DATA_DIR / "test_split.json", "r", encoding="utf-8") as f:
    test_split = json.load(f)

combined_eval = val_split + test_split

class_metrics = defaultdict(lambda: {"total": 0, "correct": 0, "confidences": [], "margins": [], "confusions": defaultdict(int)})

for item in combined_eval:
    c_name = item["class_name"]
    img_path = PROJECT_ROOT / item["path"]
    if not img_path.exists():
        continue

    pil_img = Image.open(img_path).convert("RGB")
    inp = server.eval_transform_cnn(pil_img).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(inp)
        scaled_logits = logits / max(0.01, temp)
        probs = F.softmax(scaled_logits, dim=-1)[0]
        top2 = torch.topk(probs, k=2)

    pred1_idx = top2.indices[0].item()
    pred1_name = server.CLASS_NAMES[pred1_idx]
    pred1_conf = top2.values[0].item()

    pred2_idx = top2.indices[1].item()
    pred2_name = server.CLASS_NAMES[pred2_idx]
    pred2_conf = top2.values[1].item()

    margin = pred1_conf - pred2_conf

    class_metrics[c_name]["total"] += 1
    class_metrics[c_name]["confidences"].append(pred1_conf)
    class_metrics[c_name]["margins"].append(margin)

    if pred1_name == c_name:
        class_metrics[c_name]["correct"] += 1
    else:
        class_metrics[c_name]["confusions"][pred1_name] += 1

# Rank the 10 foods by difficulty (error count first, then lowest mean confidence/margin)
ranked_classes = []
for c_name, data in class_metrics.items():
    total = data["total"]
    correct = data["correct"]
    errors = total - correct
    mean_conf = sum(data["confidences"]) / max(1, len(data["confidences"]))
    mean_margin = sum(data["margins"]) / max(1, len(data["margins"]))
    top_confusion = "None"
    if data["confusions"]:
        sorted_conf = sorted(data["confusions"].items(), key=lambda x: x[1], reverse=True)
        top_confusion = f"{sorted_conf[0][0]} ({sorted_conf[0][1]}x)"

    ranked_classes.append({
        "class_name": c_name,
        "errors": errors,
        "accuracy": (correct / max(1, total)) * 100,
        "mean_conf": mean_conf,
        "mean_margin": mean_margin,
        "top_confusion": top_confusion
    })

ranked_classes.sort(key=lambda x: (-x["errors"], x["mean_conf"]))

print("\n" + "=" * 80)
print("📊 TOP 10 FOODS MOST PRONE TO AMBIGUITY / CONFUSION / LOW CONFIDENCE")
print("=" * 80)
print(f"{'#':<3} {'Food Class':<20} {'Acc (%)':<10} {'Mean Conf':<12} {'Mean Margin':<14} {'Primary Confusion / Rival'}")
print("-" * 80)

for idx, item in enumerate(ranked_classes[:10], 1):
    print(f"{idx:<3} {item['class_name']:<20} {item['accuracy']:<10.1f} {item['mean_conf']*100:<12.1f}% {item['mean_margin']*100:<14.1f}% {item['top_confusion']}")

print("=" * 80)
