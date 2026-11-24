import os
import sys
import json
import time
import math
import random
from pathlib import Path
from collections import defaultdict

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, Subset
import torchvision.transforms as T
from torchvision.datasets import ImageFolder
from PIL import Image
import timm

# Fix seed for reproducibility
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

BASE_DIR = Path(__file__).resolve().parent
RESULTS_DIR = BASE_DIR / "results"
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

class SafeImageFolder(Dataset):
    """
    Wraps ImageFolder to safely skip corrupted or unreadable images.
    """
    def __init__(self, root, transform=None):
        self.root = Path(root)
        self.transform = transform
        self.samples = []
        self.classes = []
        self.class_to_idx = {}
        
        # Discover classes
        dirs = sorted([d for d in self.root.iterdir() if d.is_dir() and not d.name.startswith('.')])
        self.classes = [d.name for d in dirs]
        self.class_to_idx = {c: i for i, c in enumerate(self.classes)}
        
        valid_exts = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
        corrupted_count = 0
        
        for c_name, c_idx in self.class_to_idx.items():
            c_dir = self.root / c_name
            for f in c_dir.iterdir():
                if f.is_file() and f.suffix.lower() in valid_exts:
                    try:
                        # Quick sanity check without full decode
                        with Image.open(f) as img:
                            img.verify()
                        self.samples.append((str(f), c_idx))
                    except Exception:
                        corrupted_count += 1
                        
        if corrupted_count > 0:
            print(f"SafeImageFolder: Filtered out {corrupted_count} corrupted images.")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, target = self.samples[idx]
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
        except Exception:
            # Fallback to a black image if error occurs during decode
            img = Image.new("RGB", (224, 224), color=0)
            
        if self.transform is not None:
            img = self.transform(img)
        return img, target

def get_transforms():
    train_transform = T.Compose([
        T.RandomResizedCrop(224, scale=(0.75, 1.0), interpolation=T.InterpolationMode.BICUBIC),
        T.RandomHorizontalFlip(p=0.5),
        T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        T.RandomRotation(degrees=15),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    val_transform = T.Compose([
        T.Resize(256, interpolation=T.InterpolationMode.BICUBIC),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    return train_transform, val_transform

def create_stratified_split(samples, train_ratio=0.8, val_ratio=0.1, test_ratio=0.1, seed=SEED):
    class_indices = defaultdict(list)
    for idx, (_, target) in enumerate(samples):
        class_indices[target].append(idx)

    train_indices = []
    val_indices = []
    test_indices = []

    rng = random.Random(seed)
    for target, indices in class_indices.items():
        rng.shuffle(indices)
        n = len(indices)
        n_train = max(1, int(round(n * train_ratio)))
        n_val = max(1, int(round(n * val_ratio))) if n >= 3 else 0
        
        train_idx = indices[:n_train]
        val_idx = indices[n_train:n_train + n_val]
        test_idx = indices[n_train + n_val:]
        
        if not test_idx and len(train_idx) > 1:
            test_idx = [train_idx.pop()]

        train_indices.extend(train_idx)
        val_indices.extend(val_idx)
        test_indices.extend(test_idx)

    return train_indices, val_indices, test_indices

def train_epoch(model, loader, criterion, optimizer, scaler, device, accum_steps=1):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    optimizer.zero_grad(set_to_none=True)
    
    for batch_idx, (inputs, targets) in enumerate(loader):
        inputs = inputs.to(device, memory_format=torch.channels_last, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        with torch.amp.autocast(device_type="cuda" if device.type == "cuda" else "cpu"):
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss_scaled = loss / accum_steps

        scaler.scale(loss_scaled).backward()

        if (batch_idx + 1) % accum_steps == 0 or (batch_idx + 1) == len(loader):
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)

        running_loss += loss.item() * inputs.size(0)
        _, preds = outputs.max(1)
        correct += preds.eq(targets).sum().item()
        total += targets.size(0)

    epoch_loss = running_loss / max(1, total)
    epoch_acc = correct / max(1, total)
    return epoch_loss, epoch_acc

@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct_top1 = 0
    correct_top5 = 0
    total = 0

    for inputs, targets in loader:
        inputs = inputs.to(device, memory_format=torch.channels_last, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        with torch.amp.autocast(device_type="cuda" if device.type == "cuda" else "cpu"):
            outputs = model(inputs)
            loss = criterion(outputs, targets)

        running_loss += loss.item() * inputs.size(0)
        
        # Top 1
        _, preds = outputs.max(1)
        correct_top1 += preds.eq(targets).sum().item()

        # Top 5
        k = min(5, outputs.size(1))
        _, top5_preds = outputs.topk(k, dim=1)
        correct_top5 += top5_preds.eq(targets.view(-1, 1).expand_as(top5_preds)).sum().item()

        total += targets.size(0)

    val_loss = running_loss / max(1, total)
    val_top1 = correct_top1 / max(1, total)
    val_top5 = correct_top5 / max(1, total)
    return val_loss, val_top1, val_top5

def plot_curves(history, output_path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        epochs = range(1, len(history["train_loss"]) + 1)
        plt.figure(figsize=(12, 5))

        # Loss subplot
        plt.subplot(1, 2, 1)
        plt.plot(epochs, history["train_loss"], "b-o", label="Train Loss")
        plt.plot(epochs, history["val_loss"], "r--s", label="Val Loss")
        plt.title("Training & Validation Loss")
        plt.xlabel("Epoch")
        plt.ylabel("Loss")
        plt.grid(True, alpha=0.3)
        plt.legend()

        # Accuracy subplot
        plt.subplot(1, 2, 2)
        plt.plot(epochs, history["train_acc"], "b-o", label="Train Acc (Top-1)")
        plt.plot(epochs, history["val_top1"], "r--s", label="Val Acc (Top-1)")
        plt.plot(epochs, history["val_top5"], "g-.^", label="Val Acc (Top-5)")
        plt.title("Top-1 and Top-5 Accuracy")
        plt.xlabel("Epoch")
        plt.ylabel("Accuracy")
        plt.grid(True, alpha=0.3)
        plt.legend()

        plt.tight_layout()
        plt.savefig(output_path, dpi=200)
        plt.close()
        print(f"Training curves saved to: {output_path}")
    except Exception as e:
        print(f"Warning: Could not plot curves: {e}")

def run_training(dataset_dir, epochs_head=3, epochs_full=7, batch_size=32, num_workers=2):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    train_tf, val_tf = get_transforms()
    full_dataset = SafeImageFolder(dataset_dir, transform=train_tf)
    num_classes = len(full_dataset.classes)
    print(f"Loaded dataset from: {dataset_dir}")
    print(f"Total usable images: {len(full_dataset)}, Total classes: {num_classes}")
    
    if len(full_dataset) == 0:
        raise ValueError("Dataset has 0 usable images!")

    # Splits
    train_idx, val_idx, test_idx = create_stratified_split(full_dataset.samples)
    print(f"Splits: Train={len(train_idx)}, Val={len(val_idx)}, Test={len(test_idx)}")

    # Save split indices
    split_info = {
        "train": [full_dataset.samples[i] for i in train_idx],
        "val": [full_dataset.samples[i] for i in val_idx],
        "test": [full_dataset.samples[i] for i in test_idx],
        "classes": full_dataset.classes
    }
    with open(RESULTS_DIR / "dataset_splits.json", "w", encoding="utf-8") as f:
        json.dump(split_info, f, indent=2)

    val_dataset = SafeImageFolder(dataset_dir, transform=val_tf)

    train_subset = Subset(full_dataset, train_idx)
    val_subset = Subset(val_dataset, val_idx)
    test_subset = Subset(val_dataset, test_idx)

    train_loader = DataLoader(train_subset, batch_size=batch_size, shuffle=True,
                              num_workers=num_workers, pin_memory=True if device.type == "cuda" else False)
    val_loader = DataLoader(val_subset, batch_size=batch_size, shuffle=False,
                            num_workers=num_workers, pin_memory=True if device.type == "cuda" else False)

    # Initialize model
    print(f"Initializing timm model 'convnextv2_tiny.fcmae_ft_in22k_in1k' with {num_classes} classes...")
    model = timm.create_model("convnextv2_tiny.fcmae_ft_in22k_in1k", pretrained=True, num_classes=num_classes)
    model = model.to(device, memory_format=torch.channels_last)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_top1": [], "val_top5": []
    }

    best_val_top1 = 0.0
    best_model_path = CHECKPOINTS_DIR / "best_model.pth"

    # ================= Stage 1: Freeze Backbone =================
    print("\n--- STAGE 1: Training Classification Head Only ---")
    for param in model.parameters():
        param.requires_grad = False
    for param in model.get_classifier().parameters():
        param.requires_grad = True

    optimizer_head = torch.optim.AdamW(model.get_classifier().parameters(), lr=1e-3, weight_decay=1e-2)

    for epoch in range(1, epochs_head + 1):
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer_head, scaler, device)
        val_loss, val_top1, val_top5 = evaluate(model, val_loader, criterion, device)
        elapsed = time.time() - t0

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_top1"].append(val_top1)
        history["val_top5"].append(val_top5)

        print(f"Epoch {epoch}/{epochs_head} (Head) [{elapsed:.1f}s]: "
              f"Train Loss={train_loss:.4f}, Train Acc={train_acc*100:.2f}% | "
              f"Val Loss={val_loss:.4f}, Val Top1={val_top1*100:.2f}%, Val Top5={val_top5*100:.2f}%")

        if val_top1 > best_val_top1:
            best_val_top1 = val_top1
            torch.save(model.state_dict(), best_model_path)
            print(f"  -> Saved new best model (Val Top1: {val_top1*100:.2f}%)")

    # ================= Stage 2: Unfreeze Backbone =================
    print("\n--- STAGE 2: Fine-Tuning Entire Network ---")
    for param in model.parameters():
        param.requires_grad = True

    # Differential learning rate: backbone slower, head faster
    backbone_params = [p for n, p in model.named_parameters() if not n.startswith("head")]
    head_params = model.get_classifier().parameters()

    optimizer_full = torch.optim.AdamW([
        {"params": backbone_params, "lr": 1e-5, "weight_decay": 1e-4},
        {"params": head_params, "lr": 1e-4, "weight_decay": 1e-2}
    ])

    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer_full, T_max=epochs_full, eta_min=1e-6)

    for epoch in range(1, epochs_full + 1):
        total_epoch = epochs_head + epoch
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer_full, scaler, device)
        val_loss, val_top1, val_top5 = evaluate(model, val_loader, criterion, device)
        scheduler.step()
        elapsed = time.time() - t0

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_top1"].append(val_top1)
        history["val_top5"].append(val_top5)

        print(f"Epoch {total_epoch} (Full Fine-Tune) [{elapsed:.1f}s]: "
              f"Train Loss={train_loss:.4f}, Train Acc={train_acc*100:.2f}% | "
              f"Val Loss={val_loss:.4f}, Val Top1={val_top1*100:.2f}%, Val Top5={val_top5*100:.2f}%")

        if val_top1 > best_val_top1:
            best_val_top1 = val_top1
            torch.save(model.state_dict(), best_model_path)
            print(f"  -> Saved new best model (Val Top1: {val_top1*100:.2f}%)")

    # Save history and curves
    with open(RESULTS_DIR / "training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    plot_curves(history, RESULTS_DIR / "training_curves.png")
    print(f"\nTraining Complete! Best Validation Top-1 Accuracy: {best_val_top1*100:.2f}%")
    return model

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train ConvNeXt-V2 Food Classifier")
    parser.add_argument("--smoke", action="store_true", help="Run 1-epoch smoke test to check GPU & VRAM")
    parser.add_argument("--epochs-head", type=int, default=3, help="Epochs for head training")
    parser.add_argument("--epochs-full", type=int, default=7, help="Epochs for full training")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--num-workers", type=int, default=0, help="Dataloader workers (0 for safe Windows multiprocessing)")
    args = parser.parse_args()

    dataset_path = Path("fitsnap/Food Classification Dataset")
    if not dataset_path.exists():
        dataset_path = Path("Food Classification Dataset")
        
    print(f"Dataset root: {dataset_path.resolve()}")
    
    if args.smoke:
        print("\n=== Running GPU Smoke Test (1 Epoch) ===")
        torch.cuda.reset_peak_memory_stats()
        t_start = time.time()
        run_training(dataset_path, epochs_head=1, epochs_full=0, batch_size=args.batch_size, num_workers=args.num_workers)
        t_duration = time.time() - t_start
        peak_vram = torch.cuda.max_memory_allocated() / (1024 ** 2) if torch.cuda.is_available() else 0
        print(f"\nSMOKE TEST PASSED!")
        print(f"Smoke Test Duration: {t_duration:.2f} seconds")
        print(f"Peak GPU VRAM Allocated: {peak_vram:.1f} MiB / 6140 MiB ({(peak_vram/6140)*100:.1f}%)")
    else:
        print(f"\n=== Running Full Two-Stage Training ({args.epochs_head} Head + {args.epochs_full} Full Epochs) ===")
        run_training(dataset_path, epochs_head=args.epochs_head, epochs_full=args.epochs_full, batch_size=args.batch_size, num_workers=args.num_workers)
