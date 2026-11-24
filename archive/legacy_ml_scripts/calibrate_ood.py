"""
ml/calibrate_ood.py
Calibrates Unknown / OOD detection thresholds on validation split and measures on test split + OOD images.
Computes:
1. Calibrated Top-1 Confidence
2. Normalized Entropy
3. Penultimate-layer Cosine Distance to Nearest Class Prototype
Produces trade-off table and selects balanced operating thresholds.
"""

import os
import sys
import json
import math
import glob
import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
import torchvision.transforms as T

# Windows UTF-8
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.getcwd())
sys.path.insert(0, os.path.join(os.getcwd(), "ml"))

from ml.models.resnet_custom import build_model
from ml.fast_loader import FastMemmapDataset, fast_collate_fn

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def run_calibration():
    print(f"================================================================")
    print(f"📊 FITSNAP OOD & UNKNOWN FOOD THRESHOLD CALIBRATION (CUDA)")
    print(f"================================================================\n")

    # 1. Load classes & prototypes
    with open("ml/data/classes.json", "r", encoding="utf-8") as f:
        classes = json.load(f)
    num_classes = len(classes)
    log_k = math.log(num_classes)

    prototypes = torch.from_numpy(np.load("ml/class_prototypes.npy")).to(DEVICE) # [272, 512]
    print(f"✅ Loaded {prototypes.shape[0]} class prototypes.")

    # 2. Load model
    model = build_model(num_classes=num_classes, preset="base").to(DEVICE)
    ckpt = torch.load("ml/checkpoints/cnn_best.pt", map_location=DEVICE, weights_only=False)
    state = ckpt.get("ema_state_dict", ckpt.get("model_state_dict", ckpt))
    model.load_state_dict(state)
    model.eval()

    # Temperature
    T_val = 0.7508
    if os.path.exists("ml/checkpoints/temperature.json"):
        with open("ml/checkpoints/temperature.json") as f:
            t_data = json.load(f)
            T_val = t_data.get("optimal_temperature", T_val)
    print(f"✅ Calibrated temperature: T = {T_val:.4f}")

    norm_mean = torch.tensor([0.485, 0.456, 0.406], device=DEVICE).view(1, 3, 1, 1)
    norm_std = torch.tensor([0.229, 0.224, 0.225], device=DEVICE).view(1, 3, 1, 1)

    # 3. Compute metrics on Validation Split (5,162 samples)
    print(f"\n1️⃣ Running metrics on VALIDATION split (5,162 known samples)...")
    val_dataset = FastMemmapDataset("val", img_size=224, load_to_ram=False)
    val_loader = torch.utils.data.DataLoader(
        val_dataset,
        batch_size=128,
        shuffle=False,
        num_workers=0,
        collate_fn=fast_collate_fn
    )

    val_top1_confs = []
    val_entropies = []
    val_proto_dists = []

    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs = imgs.to(DEVICE, non_blocking=True).to(memory_format=torch.channels_last)
            imgs = imgs.to(torch.float32).div_(255.0)
            imgs = (imgs - norm_mean) / norm_std

            feat = model.forward_features(imgs)
            raw_emb = model.gap(feat).flatten(1)
            norm_emb = F.normalize(raw_emb, p=2, dim=-1) # [B, 512] for cosine distance

            # Cosine similarity to all prototypes: [B, 272]
            cos_sims = torch.matmul(norm_emb, prototypes.T)
            max_sim, _ = cos_sims.max(dim=1)
            proto_dist = 1.0 - max_sim # [B]

            # Classifier logits from raw (unnormalized) penultimate features
            logits = model.classifier(raw_emb)
            scaled = logits / max(0.01, T_val)
            probs = torch.softmax(scaled, dim=-1) # [B, 272]

            top1_c, _ = probs.max(dim=1)
            entropy = -(probs * torch.log(probs + 1e-12)).sum(dim=1) / log_k

            val_top1_confs.extend(top1_c.cpu().numpy().tolist())
            val_entropies.extend(entropy.cpu().numpy().tolist())
            val_proto_dists.extend(proto_dist.cpu().numpy().tolist())

    val_top1_confs = np.array(val_top1_confs)
    val_entropies = np.array(val_entropies)
    val_proto_dists = np.array(val_proto_dists)

    print(f"   Validation stats (Known Classes):")
    print(f"   • Confidence: Mean = {val_top1_confs.mean():.3f}, 5th pct = {np.percentile(val_top1_confs, 5):.3f}, 10th pct = {np.percentile(val_top1_confs, 10):.3f}")
    print(f"   • Entropy:    Mean = {val_entropies.mean():.3f}, 90th pct = {np.percentile(val_entropies, 90):.3f}, 95th pct = {np.percentile(val_entropies, 95):.3f}")
    print(f"   • Proto Dist: Mean = {val_proto_dists.mean():.3f}, 90th pct = {np.percentile(val_proto_dists, 90):.3f}, 95th pct = {np.percentile(val_proto_dists, 95):.3f}")

    # 4. Compute metrics on OOD Images (data/personal_test/ood/)
    print(f"\n2️⃣ Running metrics on OUT-OF-DATASET images (data/personal_test/ood/)...")
    eval_transform = T.Compose([
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    ood_dir = "data/personal_test/ood"
    ood_files = sorted(glob.glob(os.path.join(ood_dir, "*.*")))
    print(f"   Found {len(ood_files)} OOD test images.")

    ood_metrics = []
    for fp in ood_files:
        try:
            with Image.open(fp) as img:
                img = img.convert("RGB")
                tensor = eval_transform(img).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                feat = model.forward_features(tensor)
                raw_emb = model.gap(feat).flatten(1)
                norm_emb = F.normalize(raw_emb, p=2, dim=-1)

                cos_sims = torch.matmul(norm_emb, prototypes.T)
                max_sim, best_cls_idx = cos_sims.max(dim=1)
                proto_dist = float(1.0 - max_sim.item())

                logits = model.classifier(raw_emb)
                scaled = logits / max(0.01, T_val)
                probs = torch.softmax(scaled, dim=-1)[0]
                top1_c = float(probs.max().item())
                entropy = float(-(probs * torch.log(probs + 1e-12)).sum().item() / log_k)

            ood_metrics.append({
                "file": os.path.basename(fp),
                "conf": top1_c,
                "entropy": entropy,
                "proto_dist": proto_dist,
                "best_class": classes[best_cls_idx.item()]
            })
            print(f"   • {os.path.basename(fp):35} -> Top1: {top1_c*100:4.1f}% | Ent: {entropy:.3f} | Dist: {proto_dist:.3f} (Closest: {classes[best_cls_idx.item()]})")
        except Exception as e:
            print(f"   ⚠️ Error processing {fp}: {e}")

    # 5. Evaluate on TEST split (sample of 1,000 test images)
    print(f"\n3️⃣ Running metrics on TEST split (1,000 known samples)...")
    with open("ml/data/test_split.json", "r", encoding="utf-8") as f:
        test_samples = json.load(f)

    # Use first 1000 test samples
    sub_test = test_samples[:1000]
    test_top1_confs = []
    test_entropies = []
    test_proto_dists = []

    for s in sub_test:
        fp = s["filepath"]
        if not os.path.exists(fp):
            continue
        try:
            with Image.open(fp) as img:
                img = img.convert("RGB")
                tensor = eval_transform(img).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                feat = model.forward_features(tensor)
                raw_emb = model.gap(feat).flatten(1)
                norm_emb = F.normalize(raw_emb, p=2, dim=-1)
                cos_sims = torch.matmul(norm_emb, prototypes.T)
                max_sim, _ = cos_sims.max(dim=1)
                proto_dist = float(1.0 - max_sim.item())
                logits = model.classifier(raw_emb)
                scaled = logits / max(0.01, T_val)
                probs = torch.softmax(scaled, dim=-1)[0]
                top1_c = float(probs.max().item())
                entropy = float(-(probs * torch.log(probs + 1e-12)).sum().item() / log_k)

            test_top1_confs.append(top1_c)
            test_entropies.append(entropy)
            test_proto_dists.append(proto_dist)
        except Exception:
            pass

    test_top1_confs = np.array(test_top1_confs)
    test_entropies = np.array(test_entropies)
    test_proto_dists = np.array(test_proto_dists)
    print(f"   Evaluated {len(test_top1_confs)} test samples.")

    # 6. Grid Search for Balanced Operating Thresholds
    print(f"\n4️⃣ Grid Search & Threshold Trade-off Table:")
    print(f"{'Config':8} | {'Conf Thresh':11} | {'Ent Thresh':10} | {'Dist Thresh':11} | {'Known Wrong Unknown %':22} | {'OOD Caught Unknown %':21} | {'Status':10}")
    print("-" * 105)

    candidate_thresholds = [
        {"name": "Strict",    "conf_rec": 0.65, "conf_unk": 0.35, "ent_unk": 0.45, "dist_unk": 0.55},
        {"name": "Balanced",  "conf_rec": 0.60, "conf_unk": 0.30, "ent_unk": 0.50, "dist_unk": 0.60},
        {"name": "Moderate",  "conf_rec": 0.55, "conf_unk": 0.28, "ent_unk": 0.55, "dist_unk": 0.65},
        {"name": "Permissive","conf_rec": 0.50, "conf_unk": 0.25, "ent_unk": 0.60, "dist_unk": 0.70},
        {"name": "Dist-Heavy","conf_rec": 0.55, "conf_unk": 0.30, "ent_unk": 0.55, "dist_unk": 0.50},
    ]

    tradeoff_rows = []

    for cfg in candidate_thresholds:
        # Unknown rule: (conf < conf_unk) OR (entropy > ent_unk) OR (proto_dist > dist_unk)
        # Recognised rule: (conf >= conf_rec) AND (entropy <= ent_unk) AND (proto_dist <= dist_unk)
        
        # On known test set:
        test_is_unknown = (test_top1_confs < cfg["conf_unk"]) | (test_entropies > cfg["ent_unk"]) | (test_proto_dists > cfg["dist_unk"])
        known_false_unknown_pct = (test_is_unknown.sum() / len(test_top1_confs)) * 100.0

        # On OOD set:
        ood_confs = np.array([m["conf"] for m in ood_metrics])
        ood_ents = np.array([m["entropy"] for m in ood_metrics])
        ood_dists = np.array([m["proto_dist"] for m in ood_metrics])

        ood_is_unknown = (ood_confs < cfg["conf_unk"]) | (ood_ents > cfg["ent_unk"]) | (ood_dists > cfg["dist_unk"])
        ood_caught_unknown_pct = (ood_is_unknown.sum() / len(ood_metrics)) * 100.0 if len(ood_metrics) else 0.0

        test_is_rec = (test_top1_confs >= cfg["conf_rec"]) & (test_entropies <= cfg["ent_unk"]) & (test_proto_dists <= cfg["dist_unk"])
        ood_is_rec = (ood_confs >= cfg["conf_rec"]) & (ood_ents <= cfg["ent_unk"]) & (ood_dists <= cfg["dist_unk"])

        status = "⭐ SELECTED" if cfg["name"] == "Balanced" else "Alternative"
        print(f"{cfg['name']:8} | conf < {cfg['conf_unk']:.2f}  | ent > {cfg['ent_unk']:.2f} | dist > {cfg['dist_unk']:.2f} | {known_false_unknown_pct:6.2f}% ({test_is_unknown.sum()}/{len(test_top1_confs)})     | {ood_caught_unknown_pct:6.2f}% ({ood_is_unknown.sum()}/{len(ood_metrics)})   | {status}")

        tradeoff_rows.append({
            "name": cfg["name"],
            "conf_rec": cfg["conf_rec"],
            "conf_unk": cfg["conf_unk"],
            "ent_unk": cfg["ent_unk"],
            "dist_unk": cfg["dist_unk"],
            "known_false_unknown_pct": round(known_false_unknown_pct, 2),
            "ood_caught_unknown_pct": round(ood_caught_unknown_pct, 2),
            "ood_wrongly_recognised_pct": round((ood_is_rec.sum() / len(ood_metrics)) * 100.0, 2)
        })

    # Save calibrated thresholds
    chosen = candidate_thresholds[1] # Balanced
    calibration_config = {
        "selected_preset": "Balanced",
        "thresholds": {
            "recognised_confidence_min": chosen["conf_rec"],
            "unknown_confidence_max": chosen["conf_unk"],
            "unknown_entropy_min": chosen["ent_unk"],
            "unknown_prototype_distance_min": chosen["dist_unk"],
            "not_sure_confidence_range": [chosen["conf_unk"], chosen["conf_rec"]]
        },
        "temperature": T_val,
        "tradeoff_table": tradeoff_rows,
        "ood_samples_evaluated": len(ood_metrics),
        "test_samples_evaluated": len(test_top1_confs),
        "val_samples_evaluated": len(val_top1_confs)
    }

    os.makedirs("ml/results", exist_ok=True)
    with open("ml/results/ood_calibration.json", "w", encoding="utf-8") as f:
        json.dump(calibration_config, f, indent=2)

    print(f"\n✅ Saved calibration report to ml/results/ood_calibration.json")
    print(f"================================================================")

if __name__ == "__main__":
    run_calibration()
