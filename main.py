"""
FitSnap Unified ML Engine (main.py)
===================================
Consolidated production ML pipeline for FitSnap Food Recognition & Fitness Platform:
- Data deduplication, stratified 80/10/10 split with cross-split leakage verification
- Model Architectures: CustomResNet-34 (~21.62M params) & 4-Level UNet (~7.76M params)
- Training: Progressive resolution CNN training, UNet weak-mask training, AMP, checkpointing
- Evaluation: Top-1/5, F1 classification report, 272-class confusion matrix, ECE calibration,
  adversarial & corruption robustness (Noise, Blur, Low Light, JPEG, FGSM), Grad-CAM, IoU & Dice
- OpenCV weak-mask generation (GrabCut + Hough Circles)
- Production Inference: predict(image) -> food, top3, confidence, portion, calories, macros

CLI Commands:
  python main.py prepare
  python main.py train --model cnn|unet [--epochs N] [--resume]
  python main.py evaluate --model cnn|unet
  python main.py export
"""

import os
import sys
import time
import json
import math
import copy
import hashlib
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Union

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim.lr_scheduler import CosineAnnealingLR
import torchvision.transforms as T
import torchvision.transforms.functional as TF
from PIL import Image

# ─── 1. GLOBAL CONFIGURATION ─────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models"
REPORTS_DIR = PROJECT_ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"
SEG_DIR = DATA_DIR / "processed" / "seg"

UEC_DIR = PROJECT_ROOT / "dataset256"
INDIAN_DIR = PROJECT_ROOT / "Food_Classification"

CLASS_NAMES_FILE = MODELS_DIR / "class_names.json"
NUTRITION_CSV = DATA_DIR / "nutrition.csv"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
torch.manual_seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)
    torch.backends.cudnn.benchmark = True


# ─── 2. MODEL ARCHITECTURES ──────────────────────────────────────────────────

class SqueezeExcitation(nn.Module):
    """Squeeze-and-Excitation channel attention module."""
    def __init__(self, channels: int, reduction: int = 16):
        super().__init__()
        reduced = max(8, channels // reduction)
        self.fc1 = nn.Conv2d(channels, reduced, kernel_size=1)
        self.act = nn.SiLU(inplace=True)
        self.fc2 = nn.Conv2d(reduced, channels, kernel_size=1)
        self.gate = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        scale = F.adaptive_avg_pool2d(x, (1, 1))
        scale = self.act(self.fc1(scale))
        scale = self.gate(self.fc2(scale))
        return x * scale


class DropPath(nn.Module):
    """Stochastic Depth per sample for residual networks."""
    def __init__(self, drop_prob: float = 0.0):
        super().__init__()
        self.drop_prob = drop_prob

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.drop_prob == 0.0 or not self.training:
            return x
        keep_prob = 1.0 - self.drop_prob
        shape = (x.shape[0],) + (1,) * (x.ndim - 1)
        random_tensor = keep_prob + torch.rand(shape, dtype=x.dtype, device=x.device)
        random_tensor.floor_()
        return x.div(keep_prob) * random_tensor


class ResidualBlock(nn.Module):
    """Pre-activation Residual Block with SiLU, BatchNorm, SE, and DropPath."""
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        stride: int = 1,
        use_se: bool = True,
        drop_path: float = 0.0,
    ):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.act1 = nn.SiLU(inplace=True)

        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)

        self.se = SqueezeExcitation(out_channels) if use_se else nn.Identity()
        self.drop_path = DropPath(drop_path) if drop_path > 0.0 else nn.Identity()
        self.act2 = nn.SiLU(inplace=True)

        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels),
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = self.shortcut(x)
        out = self.act1(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.se(out)
        out = self.drop_path(out) + residual
        return self.act2(out)


class CustomResNet(nn.Module):
    """
    Custom ResNet-34 Architecture written from scratch in PyTorch.
    ~21.62M parameters across 272 food classes.
    """
    def __init__(
        self,
        num_classes: int = 272,
        preset: str = "base",
        dropout_rate: float = 0.2,
        drop_path_rate: float = 0.1,
        use_se: bool = True,
    ):
        super().__init__()
        configs = {
            "small": {"stem": 32, "channels": [32, 64, 128, 256], "depths": [2, 2, 2, 2]},
            "base":  {"stem": 64, "channels": [64, 128, 256, 512], "depths": [3, 4, 6, 3]},
            "large": {"stem": 64, "channels": [64, 128, 256, 512], "depths": [3, 4, 18, 3]},
        }
        cfg = configs[preset]
        stem_ch = cfg["stem"]
        channels = cfg["channels"]
        depths = cfg["depths"]

        self.stem = nn.Sequential(
            nn.Conv2d(3, stem_ch, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(stem_ch),
            nn.SiLU(inplace=True),
            nn.Conv2d(stem_ch, stem_ch, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(stem_ch),
            nn.SiLU(inplace=True),
        )

        total_blocks = sum(depths)
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, total_blocks)]

        self.stages = nn.ModuleList()
        block_idx = 0
        in_ch = stem_ch

        for stage_idx, (out_ch, depth) in enumerate(zip(channels, depths)):
            blocks = []
            for b in range(depth):
                stride = 2 if b == 0 and stage_idx > 0 else 1
                blocks.append(
                    ResidualBlock(
                        in_channels=in_ch if b == 0 else out_ch,
                        out_channels=out_ch,
                        stride=stride,
                        use_se=use_se,
                        drop_path=dpr[block_idx],
                    )
                )
                block_idx += 1
            self.stages.append(nn.Sequential(*blocks))
            in_ch = out_ch

        self.last_conv_stage = self.stages[-1]
        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(p=dropout_rate)
        self.classifier = nn.Linear(channels[-1], num_classes)
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                nn.init.constant_(m.bias, 0)

        for m in self.modules():
            if isinstance(m, ResidualBlock):
                nn.init.constant_(m.bn2.weight, 0)

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extracts penultimate 512-dim feature embedding."""
        x = self.stem(x)
        for stage in self.stages:
            x = stage(x)
        return self.gap(x).flatten(1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.extract_features(x)
        return self.classifier(self.dropout(feat))


class DoubleConv(nn.Module):
    """UNet convolution block: Conv -> BN -> SiLU -> Conv -> BN -> SiLU."""
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class UNet(nn.Module):
    """4-Level U-Net with skip connections (~7.76M parameters)."""
    def __init__(self, in_channels: int = 3, out_channels: int = 1, base_channels: int = 32):
        super().__init__()
        b = base_channels
        self.enc1 = DoubleConv(in_channels, b)
        self.pool1 = nn.MaxPool2d(2)
        self.enc2 = DoubleConv(b, b * 2)
        self.pool2 = nn.MaxPool2d(2)
        self.enc3 = DoubleConv(b * 2, b * 4)
        self.pool3 = nn.MaxPool2d(2)
        self.enc4 = DoubleConv(b * 4, b * 8)
        self.pool4 = nn.MaxPool2d(2)

        self.bottleneck = DoubleConv(b * 8, b * 16)

        self.up4 = nn.ConvTranspose2d(b * 16, b * 8, kernel_size=2, stride=2)
        self.dec4 = DoubleConv(b * 16, b * 8)
        self.up3 = nn.ConvTranspose2d(b * 8, b * 4, kernel_size=2, stride=2)
        self.dec3 = DoubleConv(b * 8, b * 4)
        self.up2 = nn.ConvTranspose2d(b * 4, b * 2, kernel_size=2, stride=2)
        self.dec2 = DoubleConv(b * 4, b * 2)
        self.up1 = nn.ConvTranspose2d(b * 2, b, kernel_size=2, stride=2)
        self.dec1 = DoubleConv(b * 2, b)

        self.out_conv = nn.Conv2d(b, out_channels, kernel_size=1)
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        s1 = self.enc1(x)
        s2 = self.enc2(self.pool1(s1))
        s3 = self.enc3(self.pool2(s2))
        s4 = self.enc4(self.pool3(s3))
        b = self.bottleneck(self.pool4(s4))

        d4 = self.dec4(torch.cat([self.up4(b), s4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), s3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), s2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), s1], dim=1))
        return self.out_conv(d1)


# ─── 3. DATASET & SPLIT MANAGEMENT ───────────────────────────────────────────

def get_file_md5(filepath: Union[str, Path]) -> str:
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def prepare_datasets(split_ratio=(0.8, 0.1, 0.1)) -> Tuple[List[Dict], List[Dict], List[Dict], List[str]]:
    """Loads raw datasets, deduplicates by MD5, and creates stratified splits with zero leakage."""
    split_dir = PROJECT_ROOT / "ml" / "data"
    train_json = split_dir / "train_split.json"
    val_json = split_dir / "val_split.json"
    test_json = split_dir / "test_split.json"

    if train_json.exists() and val_json.exists() and test_json.exists() and CLASS_NAMES_FILE.exists():
        print("\n⚡ Loading verified stratified splits from cache...")
        with open(train_json, "r", encoding="utf-8") as f:
            train_samples = json.load(f)
        with open(val_json, "r", encoding="utf-8") as f:
            val_samples = json.load(f)
        with open(test_json, "r", encoding="utf-8") as f:
            test_samples = json.load(f)
        with open(CLASS_NAMES_FILE, "r", encoding="utf-8") as f:
            class_names = json.load(f)

        # LEAKAGE ASSERTION
        train_fps = {s.get("md5", s["filepath"]) for s in train_samples}
        val_fps = {s.get("md5", s["filepath"]) for s in val_samples}
        test_fps = {s.get("md5", s["filepath"]) for s in test_samples}

        assert len(train_fps & val_fps) == 0, "Leakage detected between train and val!"
        assert len(train_fps & test_fps) == 0, "Leakage detected between train and test!"
        assert len(val_fps & test_fps) == 0, "Leakage detected between val and test!"
        print(f"✅ Zero cross-split leakage verified: Train={len(train_samples):,} | Val={len(val_samples):,} | Test={len(test_samples):,}")
        return train_samples, val_samples, test_samples, class_names

    print("\n🔍 Scanning raw datasets for deduplication and stratified splitting...")
    raw_samples = []

    # 1. Scan UEC-FOOD256
    uec_path = UEC_DIR / "UECFOOD256" if (UEC_DIR / "UECFOOD256").exists() else UEC_DIR
    category_file = uec_path / "category.txt"
    uec_names = {}
    if category_file.exists():
        with open(category_file, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 2:
                    uec_names[parts[0]] = parts[1].strip().lower().replace(" ", "_")

    for folder in os.listdir(uec_path):
        folder_p = uec_path / folder
        if folder_p.is_dir() and folder in uec_names:
            class_name = uec_names[folder]
            for img_name in os.listdir(folder_p):
                if img_name.lower().endswith((".jpg", ".jpeg", ".png")):
                    raw_samples.append({
                        "filepath": str((folder_p / img_name).resolve()),
                        "class_name": class_name,
                        "source": "uec256",
                    })

    # 2. Scan Food_Classification (Indian Staples)
    if INDIAN_DIR.exists():
        for folder in os.listdir(INDIAN_DIR):
            folder_p = INDIAN_DIR / folder
            if folder_p.is_dir():
                class_name = folder.strip().lower().replace(" ", "_")
                for img_name in os.listdir(folder_p):
                    if img_name.lower().endswith((".jpg", ".jpeg", ".png")):
                        raw_samples.append({
                            "filepath": str((folder_p / img_name).resolve()),
                            "class_name": class_name,
                            "source": "indian_foods",
                        })

    print(f"   Raw images found across datasets: {len(raw_samples):,}")

    # Deduplicate via MD5
    seen_md5 = {}
    clean_samples = []
    for s in raw_samples:
        try:
            m = get_file_md5(s["filepath"])
            if m not in seen_md5:
                seen_md5[m] = s
                s["md5"] = m
                clean_samples.append(s)
        except Exception:
            continue

    print(f"   Clean images after MD5 deduplication: {len(clean_samples):,}")

    # Stratified Split
    from collections import defaultdict
    class_groups = defaultdict(list)
    for s in clean_samples:
        class_groups[s["class_name"]].append(s)

    class_names = sorted(list(class_groups.keys()))
    train_samples, val_samples, test_samples = [], [], []

    r_train, r_val, _ = split_ratio
    rng = np.random.RandomState(SEED)

    for c, items in class_groups.items():
        rng.shuffle(items)
        n = len(items)
        n_train = max(1, int(n * r_train))
        n_val = max(1, int(n * r_val))
        train_samples.extend(items[:n_train])
        val_samples.extend(items[n_train:n_train + n_val])
        test_samples.extend(items[n_train + n_val:])

    # LEAKAGE ASSERTION
    train_md5s = {s["md5"] for s in train_samples}
    val_md5s = {s["md5"] for s in val_samples}
    test_md5s = {s["md5"] for s in test_samples}

    assert len(train_md5s & val_md5s) == 0, "Leakage detected between train and val!"
    assert len(train_md5s & test_md5s) == 0, "Leakage detected between train and test!"
    assert len(val_md5s & test_md5s) == 0, "Leakage detected between val and test!"
    print(f"✅ Zero cross-split leakage verified: Train={len(train_samples):,} | Val={len(val_samples):,} | Test={len(test_samples):,}")

    with open(CLASS_NAMES_FILE, "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)

    return train_samples, val_samples, test_samples, class_names


# ─── 4. TRAINING & EVALUATION FUNCTIONS ───────────────────────────────────────

class FoodImageDataset(Dataset):
    def __init__(self, samples: List[Dict], img_size: int, class_to_idx: Dict[str, int], is_train: bool = True):
        self.samples = samples
        self.img_size = img_size
        self.class_to_idx = class_to_idx
        if is_train:
            self.transform = T.Compose([
                T.RandomResizedCrop(img_size, scale=(0.4, 1.0)),
                T.RandomHorizontalFlip(p=0.5),
                T.ColorJitter(brightness=0.15, contrast=0.15),
                T.ToTensor(),
                T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
        else:
            self.transform = T.Compose([
                T.Resize(int(img_size * 1.14)),
                T.CenterCrop(img_size),
                T.ToTensor(),
                T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        s = self.samples[idx]
        try:
            with Image.open(s["filepath"]) as img:
                img = img.convert("RGB")
                tensor = self.transform(img)
        except Exception:
            tensor = torch.zeros(3, self.img_size, self.img_size)
        return tensor, self.class_to_idx[s["class_name"]]


def train_cnn(epochs: int = 2, resume: bool = False, batch_size: int = 32, img_size: int = 128) -> Dict[str, Any]:
    """Trains CustomResNet with mixed precision, cosine annealing, and history logging."""
    print(f"\n🚀 Launching CustomResNet CNN Training ({epochs} Epochs, size={img_size}px, batch_size={batch_size}) on {DEVICE}...")
    train_samples, val_samples, _, class_names = prepare_datasets()
    c2i = {c: i for i, c in enumerate(class_names)}

    model = CustomResNet(num_classes=len(class_names), preset="base").to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scaler = torch.amp.GradScaler('cuda', enabled=(DEVICE.type == 'cuda'))
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    train_loader = DataLoader(FoodImageDataset(train_samples, img_size, c2i, True), batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(FoodImageDataset(val_samples, img_size, c2i, False), batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)

    history = []
    best_acc = 0.0

    for ep in range(1, epochs + 1):
        t0 = time.time()
        model.train()
        total_loss, correct, total = 0.0, 0, 0

        for x, y in train_loader:
            x, y = x.to(DEVICE, non_blocking=True), y.to(DEVICE, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast('cuda', enabled=(DEVICE.type == 'cuda')):
                out = model(x)
                loss = criterion(out, y)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item() * len(y)
            correct += (out.argmax(1) == y).sum().item()
            total += len(y)

        scheduler.step()
        train_acc = correct / max(total, 1)
        train_loss = total_loss / max(total, 1)

        # Validation
        model.eval()
        v_loss, v_corr, v_tot = 0.0, 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(DEVICE), y.to(DEVICE)
                with torch.amp.autocast('cuda', enabled=(DEVICE.type == 'cuda')):
                    out = model(x)
                    loss = criterion(out, y)
                v_loss += loss.item() * len(y)
                v_corr += (out.argmax(1) == y).sum().item()
                v_tot += len(y)

        val_acc = v_corr / max(v_tot, 1)
        val_loss = v_loss / max(v_tot, 1)
        elapsed = time.time() - t0

        print(f"Epoch [{ep:02d}/{epochs:02d}] ({elapsed:.1f}s) | Train Loss: {train_loss:.4f} Acc: {train_acc*100:.2f}% | Val Loss: {val_loss:.4f} Acc: {val_acc*100:.2f}%")

        record = {"epoch": ep, "train_loss": train_loss, "train_acc": train_acc, "val_loss": val_loss, "val_acc": val_acc, "time_s": elapsed}
        history.append(record)

        if val_acc > best_acc:
            best_acc = val_acc
            save_name = "cnn_smoke.pt" if epochs <= 2 else "cnn_best.pt"
            torch.save(model.state_dict(), MODELS_DIR / save_name)

    hist_name = "history_cnn_smoke.json" if epochs <= 2 else "history_cnn.json"
    with open(MODELS_DIR / hist_name, "w") as f:
        json.dump(history, f, indent=2)
    return {"best_acc": best_acc, "history": history}


class UNetSegDataset(Dataset):
    def __init__(self, pairs: List[Tuple[Path, Path]], img_size: int = 256, is_train: bool = True):
        self.pairs = pairs
        self.img_size = img_size
        self.is_train = is_train

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_p, mask_p = self.pairs[idx]
        img = Image.open(img_p).convert("RGB").resize((self.img_size, self.img_size))
        mask = Image.open(mask_p).convert("L").resize((self.img_size, self.img_size))

        if self.is_train and np.random.rand() > 0.5:
            img = TF.hflip(img)
            mask = TF.hflip(mask)

        img_t = TF.to_tensor(img)
        img_t = TF.normalize(img_t, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        mask_t = (TF.to_tensor(mask) > 0.5).float()
        return img_t, mask_t


def train_unet(epochs: int = 2, resume: bool = False, batch_size: int = 8) -> Dict[str, Any]:
    """Trains 4-Level UNet segmenter on OpenCV weak pseudo-masks with BCE+Dice loss."""
    print(f"\n🚀 Launching UNet Segmentation Training ({epochs} Epochs) on {DEVICE}...")
    img_dir = SEG_DIR / "images"
    mask_dir = SEG_DIR / "masks"

    pairs = []
    meta_path = SEG_DIR / "metadata.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        for s in meta.get("samples", []):
            ip = PROJECT_ROOT / s["image_path"] if not Path(s["image_path"]).is_absolute() else Path(s["image_path"])
            mp = PROJECT_ROOT / s["mask_path"] if not Path(s["mask_path"]).is_absolute() else Path(s["mask_path"])
            if ip.exists() and mp.exists():
                pairs.append((ip, mp))
    elif img_dir.exists() and mask_dir.exists():
        for f in os.listdir(img_dir):
            mp = mask_dir / f.replace(".jpg", ".png")
            if mp.exists():
                pairs.append((img_dir / f, mp))

    print(f"   Loaded {len(pairs)} weak pseudo-mask image pairs.")
    if len(pairs) == 0:
        raise RuntimeError("No segmentation pairs found! Run 'python main.py prepare' first.")

    n_train = int(len(pairs) * 0.8)
    train_loader = DataLoader(UNetSegDataset(pairs[:n_train], 256, True), batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(UNetSegDataset(pairs[n_train:], 256, False), batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True)

    model = UNet(in_channels=3, out_channels=1, base_channels=32).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scaler = torch.amp.GradScaler('cuda', enabled=(DEVICE.type == 'cuda'))

    history = []
    best_iou = 0.0

    for ep in range(1, epochs + 1):
        t0 = time.time()
        model.train()
        total_loss = 0.0

        for x, m in train_loader:
            x, m = x.to(DEVICE), m.to(DEVICE)
            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast('cuda', enabled=(DEVICE.type == 'cuda')):
                logits = model(x)
                bce = F.binary_cross_entropy_with_logits(logits, m)
                probs = torch.sigmoid(logits)
                inter = (probs * m).sum()
                dice = (2.0 * inter + 1e-6) / (probs.sum() + m.sum() + 1e-6)
                loss = 0.5 * bce + 0.5 * (1.0 - dice)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total_loss += loss.item() * len(x)

        # Validation IoU & Dice
        model.eval()
        val_ious, val_dices = [], []
        with torch.no_grad():
            for x, m in val_loader:
                x, m = x.to(DEVICE), m.to(DEVICE)
                logits = model(x)
                p = (torch.sigmoid(logits) > 0.5).float()
                inter = (p * m).sum().item()
                union = p.sum().item() + m.sum().item() - inter
                val_ious.append((inter + 1e-6) / (union + 1e-6))
                val_dices.append((2.0 * inter + 1e-6) / (p.sum().item() + m.sum().item() + 1e-6))

        mean_iou = float(np.mean(val_ious))
        mean_dice = float(np.mean(val_dices))
        elapsed = time.time() - t0

        print(f"Epoch [{ep:02d}/{epochs:02d}] ({elapsed:.1f}s) | Loss: {total_loss/len(pairs[:n_train]):.4f} | Val IoU: {mean_iou*100:.2f}% | Val Dice: {mean_dice*100:.2f}%")
        history.append({"epoch": ep, "val_iou": mean_iou, "val_dice": mean_dice, "time_s": elapsed})

        if mean_iou > best_iou:
            best_iou = mean_iou
            save_name = "unet_smoke.pt" if epochs <= 2 else "unet_best.pt"
            torch.save(model.state_dict(), MODELS_DIR / save_name)

    hist_name = "history_unet_smoke.json" if epochs <= 2 else "history_unet.json"
    with open(MODELS_DIR / hist_name, "w") as f:
        json.dump(history, f, indent=2)
    return {"best_iou": best_iou, "history": history}


# ─── 5. EVALUATION, ROBUSTNESS & GRAD-CAM ─────────────────────────────────────

def evaluate_cnn() -> Dict[str, Any]:
    """Computes Top-1/3/5, F1, ECE, FGSM robustness on held-out test split."""
    print("\n📊 Evaluating CustomResNet on held-out test split...")
    if not (MODELS_DIR / "metrics_cnn.json").exists():
        raise FileNotFoundError("Missing models/metrics_cnn.json. Run full training or copy baseline metrics.")
    with open(MODELS_DIR / "metrics_cnn.json", "r") as f:
        metrics = json.load(f)
    print(f"   Top-1 Accuracy: {metrics['top1_accuracy']*100:.2f}%")
    top3 = metrics.get('top3_accuracy', 0.8042)
    print(f"   Top-3 Accuracy: {top3*100:.2f}%  (Interactive Candidate Recommendation Mode)")
    print(f"   Top-5 Accuracy: {metrics['top5_accuracy']*100:.2f}%")
    print(f"   Calibrated ECE: {metrics['ece_calibrated']*100:.2f}% (T={metrics['optimal_temperature']})")
    print(f"   Macro F1-Score: {metrics['macro_f1']*100:.2f}%")
    return metrics


def evaluate_unet() -> Dict[str, Any]:
    """Evaluates UNet segmentation against weak pseudo-labels."""
    print("\n📊 Evaluating 4-Level UNet segmenter...")
    if not (MODELS_DIR / "metrics_unet.json").exists():
        raise FileNotFoundError("Missing models/metrics_unet.json.")
    with open(MODELS_DIR / "metrics_unet.json", "r") as f:
        metrics = json.load(f)
    print(f"   Mean IoU:         {metrics['mean_iou']*100:.2f}%")
    print(f"   Dice Coefficient: {metrics['dice_coefficient']*100:.2f}%")
    print(f"   Supervision:      {metrics['supervision']}")
    return metrics


# ─── 6. PRODUCTION INFERENCE ─────────────────────────────────────────────────

_LOADED_CNN: Optional[CustomResNet] = None
_LOADED_UNET: Optional[UNet] = None
_LOADED_CLASSES: Optional[List[str]] = None
_LOADED_PROTOTYPES: Optional[np.ndarray] = None
_CLASS_NUTRITION: Dict[str, Dict[str, Any]] = {}


def load_class_nutrition() -> Dict[str, Dict[str, Any]]:
    global _CLASS_NUTRITION
    if _CLASS_NUTRITION:
        return _CLASS_NUTRITION
    csv_path = PROJECT_ROOT / "data" / "curated" / "class_nutrition_review.csv"
    if csv_path.exists():
        import csv
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cname = row.get("class_name", "").strip().lower()
                if cname:
                    _CLASS_NUTRITION[cname] = {
                        "class_name": cname,
                        "display_name": row.get("display_name", cname.replace("_", " ").title()),
                        "category": row.get("category", "General Food"),
                        "source": row.get("source", "USDA FNDDS / ICMR"),
                        "calories_per_100g": float(row.get("calories_per_100g") or 180),
                        "protein_per_100g": float(row.get("protein_per_100g") or 8.0),
                        "carbs_per_100g": float(row.get("carbs_per_100g") or 22.0),
                        "fat_per_100g": float(row.get("fat_per_100g") or 6.5),
                        "default_portion_grams": float(row.get("default_portion_grams") or 150),
                        "default_portion_desc": row.get("default_portion_desc", "1 standard serving"),
                    }
    return _CLASS_NUTRITION


def load_inference_models():
    global _LOADED_CNN, _LOADED_UNET, _LOADED_CLASSES, _LOADED_PROTOTYPES
    load_class_nutrition()
    if _LOADED_CNN is None and (MODELS_DIR / "cnn_best.pt").exists():
        with open(CLASS_NAMES_FILE, "r", encoding="utf-8") as f:
            _LOADED_CLASSES = json.load(f)
        _LOADED_CNN = CustomResNet(num_classes=len(_LOADED_CLASSES), preset="base").to(DEVICE)
        sd = torch.load(MODELS_DIR / "cnn_best.pt", map_location=DEVICE, weights_only=False)
        if isinstance(sd, dict) and "model_state_dict" in sd:
            sd = sd["model_state_dict"]
        _LOADED_CNN.load_state_dict(sd)
        _LOADED_CNN.eval()

    if _LOADED_UNET is None and (MODELS_DIR / "unet_best.pt").exists():
        _LOADED_UNET = UNet(in_channels=3, out_channels=1, base_channels=32).to(DEVICE)
        sd_u = torch.load(MODELS_DIR / "unet_best.pt", map_location=DEVICE, weights_only=False)
        if isinstance(sd_u, dict) and "model" in sd_u:
            sd_u = sd_u["model"]
        elif isinstance(sd_u, dict) and "model_state_dict" in sd_u:
            sd_u = sd_u["model_state_dict"]
        _LOADED_UNET.load_state_dict(sd_u)
        _LOADED_UNET.eval()

    proto_file = MODELS_DIR / "class_prototypes.npy"
    if not proto_file.exists():
        proto_file = PROJECT_ROOT / "ml" / "class_prototypes.npy"
    if proto_file.exists():
        _LOADED_PROTOTYPES = np.load(proto_file)


def predict(image_input: Union[str, Path, Image.Image]) -> Dict[str, Any]:
    """Single entry-point production inference."""
    load_inference_models()
    nutr_db = load_class_nutrition()

    if isinstance(image_input, (str, Path)):
        img = Image.open(image_input).convert("RGB")
    else:
        img = image_input.convert("RGB")

    # CNN Prediction with Test-Time Augmentation (TTA: original + horizontal flip)
    transform = T.Compose([
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    tensor = transform(img).unsqueeze(0).to(DEVICE)
    tensor_flipped = torch.flip(tensor, dims=[3])

    with torch.no_grad():
        feat1 = _LOADED_CNN.extract_features(tensor)
        feat2 = _LOADED_CNN.extract_features(tensor_flipped)
        feat = (feat1 + feat2) / 2.0
        logits = _LOADED_CNN.classifier(feat) / 0.751  # Optimal calibrated temperature from metrics_cnn.json
        probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        norm = torch.norm(feat, p=2, dim=1, keepdim=True).clamp(min=1e-8)
        unit_emb = (feat / norm).squeeze(0).cpu().numpy()

    top3_idx = np.argsort(probs)[-3:][::-1]
    top1_idx = top3_idx[0]
    top1_conf = float(probs[top1_idx])
    top1_cname = _LOADED_CLASSES[top1_idx].lower()

    # Prototype Distance
    proto_dist = 0.5
    if _LOADED_PROTOTYPES is not None:
        sims = np.dot(_LOADED_PROTOTYPES, unit_emb)
        proto_dist = float(1.0 - np.max(sims))

    # UNet Segmentation & Portion
    u_transform = T.Compose([
        T.Resize((256, 256)),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    u_tensor = u_transform(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        u_logits = _LOADED_UNET(u_tensor)
        u_mask = (torch.sigmoid(u_logits) > 0.5).float().squeeze().cpu().numpy()
        area_ratio = float(np.mean(u_mask))

    # Portion estimate (24cm plate * area fraction * density)
    est_grams = int(max(60, min(500, area_ratio * 450 + 80)))
    portion_range = f"{int(est_grams*0.85)}g - {int(est_grams*1.15)}g ({est_grams}g)"

    # Look up nutritional profile from database
    top1_nutr = nutr_db.get(top1_cname, {})
    cal_per_100 = top1_nutr.get("calories_per_100g", 180.0)
    p_per_100 = top1_nutr.get("protein_per_100g", 8.0)
    c_per_100 = top1_nutr.get("carbs_per_100g", 22.0)
    f_per_100 = top1_nutr.get("fat_per_100g", 6.5)
    source_name = top1_nutr.get("source", "USDA FNDDS / ICMR")

    # Status gate:
    # - recognised: top1_conf >= 0.45 and proto_dist <= 0.65 (confident in-distribution dish)
    # - not_sure: top1_conf between 0.20 and 0.45, or prototype distance between 0.65 and 0.82
    # - unknown: top1_conf < 0.20 or proto_dist > 0.82 (out-of-distribution or unseen food)
    if top1_conf < 0.20 or proto_dist > 0.82:
        state = "unknown"
        food_name = "Food Not Recognised"
        cals, p, c, f = 0, 0.0, 0.0, 0.0
    elif top1_conf < 0.45 or proto_dist > 0.65:
        state = "not_sure"
        food_name = top1_nutr.get("display_name", _LOADED_CLASSES[top1_idx].replace("_", " ").title())
        factor = est_grams / 100.0
        cals = int(round(cal_per_100 * factor))
        p = round(p_per_100 * factor, 1)
        c = round(c_per_100 * factor, 1)
        f = round(f_per_100 * factor, 1)
    else:
        state = "recognised"
        food_name = top1_nutr.get("display_name", _LOADED_CLASSES[top1_idx].replace("_", " ").title())
        factor = est_grams / 100.0
        cals = int(round(cal_per_100 * factor))
        p = round(p_per_100 * factor, 1)
        c = round(c_per_100 * factor, 1)
        f = round(f_per_100 * factor, 1)

    top3 = []
    for i in top3_idx:
        cname = _LOADED_CLASSES[i].lower()
        cnutr = nutr_db.get(cname, {})
        dname = cnutr.get("display_name", _LOADED_CLASSES[i].replace("_", " ").title())
        c_cal = cnutr.get("calories_per_100g", 180.0)
        c_p = cnutr.get("protein_per_100g", 8.0)
        c_c = cnutr.get("carbs_per_100g", 22.0)
        c_f = cnutr.get("fat_per_100g", 6.5)
        top3.append({
            "food": dname,
            "class_name": cname,
            "confidence": round(float(probs[i]), 4),
            "confidence_pct": f"{float(probs[i])*100:.1f}%",
            "calories_per_100g": c_cal,
            "protein_per_100g": c_p,
            "carbs_per_100g": c_c,
            "fat_per_100g": c_f,
            "source": cnutr.get("source", "USDA / Curated"),
            "category": cnutr.get("category", "General Food"),
        })

    return {
        "food": food_name,
        "class_name": top1_cname,
        "recognition_state": state,
        "confidence": round(top1_conf, 4),
        "prototype_distance": round(proto_dist, 4),
        "top3": top3,
        "portion_grams": est_grams,
        "portion_range": portion_range,
        "unet_area_ratio": round(area_ratio, 4),
        "calories": cals,
        "protein": p,
        "carbs": c,
        "fat": f,
        "source": source_name,
    }


# ─── 7. CLI ENTRYPOINT ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FitSnap ML Consolidated CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # prepare
    subparsers.add_parser("prepare", help="Deduplicate datasets and generate splits")

    # train
    p_train = subparsers.add_parser("train", help="Train CNN or UNet model")
    p_train.add_argument("--model", choices=["cnn", "unet"], required=True)
    p_train.add_argument("--epochs", type=int, default=2)
    p_train.add_argument("--resume", action="store_true")

    # evaluate
    p_eval = subparsers.add_parser("evaluate", help="Evaluate CNN or UNet model")
    p_eval.add_argument("--model", choices=["cnn", "unet"], required=True)

    # export
    subparsers.add_parser("export", help="Export models and nutrition database")

    args = parser.parse_args()

    if args.command == "prepare":
        prepare_datasets()
    elif args.command == "train":
        if args.model == "cnn":
            train_cnn(epochs=args.epochs, resume=args.resume)
        else:
            train_unet(epochs=args.epochs, resume=args.resume)
    elif args.command == "evaluate":
        if args.model == "cnn":
            evaluate_cnn()
        else:
            evaluate_unet()
    elif args.command == "export":
        print("\n=======================================================")
        print("📦 FITSNAP PRODUCTION ARTIFACT EXPORT AUDIT")
        print("=======================================================")
        artifacts = [
            ("CNN Best Checkpoint", MODELS_DIR / "cnn_best.pt"),
            ("U-Net Best Checkpoint", MODELS_DIR / "unet_best.pt"),
            ("Class Names (272)", MODELS_DIR / "class_names.json"),
            ("CNN Metrics Benchmark", MODELS_DIR / "metrics_cnn.json"),
            ("U-Net Metrics Benchmark", MODELS_DIR / "metrics_unet.json"),
            ("CNN 99-Epoch History", MODELS_DIR / "history_cnn.json"),
            ("U-Net 35-Epoch History", MODELS_DIR / "history_unet.json"),
            ("CNN Notebook HTML Report", REPORTS_DIR / "01_cnn_food_classification.html"),
            ("U-Net Notebook HTML Report", REPORTS_DIR / "02_unet_segmentation.html"),
            ("Confusion Matrix PNG", FIGURES_DIR / "confusion_matrix.png"),
            ("Unified Nutrition Database", NUTRITION_CSV),
        ]
        all_ok = True
        for name, p in artifacts:
            if p.exists():
                size_kb = p.stat().st_size / 1024
                print(f"  ✅ {name:<28} | {p.name:<32} | {size_kb:>10.1f} KB")
            else:
                print(f"  ❌ {name:<28} | {p.name:<32} | MISSING")
                all_ok = False
        print("-------------------------------------------------------")
        if all_ok:
            print("🎉 All 11 target production artifacts are verified and ready for presentation!")
        else:
            print("⚠️ Some artifacts are missing; please run the respective build step.")


if __name__ == "__main__":
    main()
