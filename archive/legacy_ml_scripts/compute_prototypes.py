"""
ml/compute_prototypes.py
Computes mean penultimate-layer embeddings (class prototypes) for all 272 classes from the training split.
Saves to ml/class_prototypes.npy.
"""

import os
import sys
import json
import torch
import torch.nn.functional as F
import numpy as np

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.getcwd())
sys.path.insert(0, os.path.join(os.getcwd(), "ml"))

try:
    from ml.models.resnet_custom import build_model
    from ml.fast_loader import FastMemmapDataset, fast_collate_fn
except ImportError:
    from models.resnet_custom import build_model
    from fast_loader import FastMemmapDataset, fast_collate_fn

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def compute_prototypes():
    print(f"⚡ Computing class prototypes on device: {DEVICE}")

    # 1. Load classes
    with open("ml/data/classes.json", "r", encoding="utf-8") as f:
        classes = json.load(f)
    num_classes = len(classes)
    print(f"📦 Total classes: {num_classes}")

    # 2. Load model
    model = build_model(num_classes=num_classes, preset="base").to(DEVICE)
    checkpoint_path = "ml/checkpoints/cnn_best.pt"
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    state_dict = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    if "ema_state_dict" in state_dict:
        model.load_state_dict(state_dict["ema_state_dict"])
    elif "model_state_dict" in state_dict:
        model.load_state_dict(state_dict["model_state_dict"])
    else:
        model.load_state_dict(state_dict)
    model.eval()

    # 3. Load dataset
    dataset = FastMemmapDataset("train", img_size=224, load_to_ram=False)
    loader = torch.utils.data.DataLoader(
        dataset,
        batch_size=128,
        shuffle=False,
        num_workers=0,
        collate_fn=fast_collate_fn
    )

    norm_mean = torch.tensor([0.485, 0.456, 0.406], device=DEVICE).view(1, 3, 1, 1)
    norm_std = torch.tensor([0.229, 0.224, 0.225], device=DEVICE).view(1, 3, 1, 1)

    # Accumulate embeddings per class
    sum_embeddings = torch.zeros(num_classes, 512, device=DEVICE)
    class_counts = torch.zeros(num_classes, device=DEVICE)

    print(f"🔄 Passing {len(dataset)} training samples through CustomResNet GAP layer...")
    processed = 0

    with torch.no_grad():
        for imgs, labels in loader:
            imgs = imgs.to(DEVICE, non_blocking=True).to(memory_format=torch.channels_last)
            labels = labels.to(DEVICE, non_blocking=True)

            # Preprocessing
            imgs = imgs.to(torch.float32).div_(255.0)
            imgs = (imgs - norm_mean) / norm_std

            feat = model.forward_features(imgs)
            pooled = model.gap(feat).flatten(1) # [B, 512]
            pooled = F.normalize(pooled, p=2, dim=-1)

            for c in range(num_classes):
                mask = (labels == c)
                if mask.any():
                    sum_embeddings[c] += pooled[mask].sum(dim=0)
                    class_counts[c] += mask.sum()

            processed += imgs.size(0)
            if processed % 5000 < 128:
                print(f"   Processed {processed}/{len(dataset)} samples ({processed/len(dataset)*100:.1f}%)...")

    # Normalize prototypes to unit vectors
    prototypes = torch.zeros(num_classes, 512, device=DEVICE)
    for c in range(num_classes):
        if class_counts[c] > 0:
            mean_emb = sum_embeddings[c] / class_counts[c]
            prototypes[c] = F.normalize(mean_emb, p=2, dim=-1)
        else:
            print(f"⚠️ Warning: Class {c} ({classes[c]}) has 0 training samples!")

    prototypes_np = prototypes.cpu().numpy()
    np.save("ml/class_prototypes.npy", prototypes_np)
    print(f"\n✅ Saved class prototypes: ml/class_prototypes.npy (shape: {prototypes_np.shape})")
    print(f"   Min class count: {class_counts.min().item():.0f}, Max class count: {class_counts.max().item():.0f}")

    # Also save class names map alongside
    with open("ml/prototype_classes.json", "w", encoding="utf-8") as f:
        json.dump({
            "num_classes": num_classes,
            "classes": classes,
            "embedding_dim": 512
        }, f, indent=2)
    print("✅ Saved metadata to ml/prototype_classes.json")

if __name__ == "__main__":
    compute_prototypes()
