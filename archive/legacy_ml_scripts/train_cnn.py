"""
ml/train_cnn.py
Production-grade training script for Custom ResNet Food Classifier on Dedicated NVIDIA GPU.
Protected by strict Windows __main__ guard for seamless multiprocessing.
Optimized for high-throughput memmap loading + GPU batch tensor augmentations.
"""

import os
import sys
import time
import json
import argparse
import copy
import tempfile
from typing import Tuple, Dict, Any

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

class TeeLogger:
    def __init__(self, filepath):
        self.terminal = sys.stdout
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        self.log_file = open(filepath, "a", encoding="utf-8", buffering=1)

    def write(self, message):
        try:
            self.terminal.write(message)
        except Exception:
            pass
        try:
            self.log_file.write(message)
            self.log_file.flush()
        except Exception:
            pass

    def flush(self):
        try:
            self.terminal.flush()
        except Exception:
            pass
        try:
            self.log_file.flush()
        except Exception:
            pass

logger = TeeLogger("ml/results/cnn_train.out")
sys.stdout = logger
sys.stderr = logger

# Record active process ID and parent process info
os.makedirs("ml/results", exist_ok=True)
with open("ml/results/train.pid", "w", encoding="utf-8") as f:
    f.write(f"{os.getpid()}\n")

try:
    import psutil
    _cur = psutil.Process(os.getpid())
    _par = _cur.parent()
    _par_name = _par.name() if _par else "None"
    _par_pid = _par.pid if _par else 0
    with open("ml/results/parent_process.txt", "w", encoding="utf-8") as f:
        f.write(f"PID: {_cur.pid} ({_cur.name()}) | Parent PID: {_par_pid} ({_par_name})\n")
    print(f"📌 [PROCESS LIFECYCLE] PID: {_cur.pid} | Parent: {_par_name} (PID {_par_pid})")
except Exception as _e:
    pass

# Prevent Windows Modern Standby / Sleep / GPU driver reset on black screen
if sys.platform == "win32":
    try:
        import ctypes
        # ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001 | 0x00000040)
    except Exception:
        pass

os.environ["MPLCONFIGDIR"] = os.path.join(tempfile.gettempdir(), "matplotlib_fitsnap")
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torch.optim.lr_scheduler import CosineAnnealingLR
import torchvision.transforms as T
from PIL import Image
import numpy as np

# Enable cuDNN benchmark for optimized CUDA convolution kernels
torch.backends.cudnn.benchmark = True

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:
    plt = None

try:
    from ml.models.resnet_custom import build_model, CustomResNet
    from ml.fast_loader import FastMemmapDataset, fast_collate_fn, GPUBatchAugmentation
except ImportError:
    from models.resnet_custom import build_model, CustomResNet
    from fast_loader import FastMemmapDataset, fast_collate_fn, GPUBatchAugmentation

# EMA Tracker
class ModelEMA:
    def __init__(self, model: nn.Module, decay: float = 0.999):
        self.ema_model = copy.deepcopy(model).eval()
        for p in self.ema_model.parameters():
            p.requires_grad = False
        self.decay = decay

    @torch.no_grad()
    def update(self, model: nn.Module):
        model_params = dict(model.named_parameters())
        for name, ema_p in self.ema_model.named_parameters():
            if name in model_params:
                ema_p.data.mul_(self.decay).add_(model_params[name].data, alpha=1.0 - self.decay)

# Fallback Cached Food Dataset (used if memmaps are not present)
class CachedFoodDataset(Dataset):
    def __init__(self, samples: list, img_size: int, class_to_idx: dict, is_training: bool = True):
        self.samples = samples
        self.img_size = img_size
        self.class_to_idx = class_to_idx
        self.is_training = is_training

        if is_training:
            self.transform = T.Compose([
                T.RandomResizedCrop(img_size, scale=(0.35, 1.0)),
                T.RandomHorizontalFlip(p=0.5),
                T.ColorJitter(brightness=0.15, contrast=0.15),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
        else:
            self.transform = T.Compose([
                T.Resize(int(img_size * 1.14)),
                T.CenterCrop(img_size),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        s = self.samples[idx]
        cache_id = s.get("md5", s.get("cache_id"))
        cached_fp = f"ml/data/cache/{self.img_size}/{cache_id}.jpg" if cache_id else None
        fp = cached_fp if (cached_fp and os.path.exists(cached_fp)) else s["filepath"]

        try:
            with Image.open(fp) as img:
                img = img.convert("RGB")
                tensor = self.transform(img)
        except Exception:
            tensor = torch.zeros(3, self.img_size, self.img_size)

        label_idx = self.class_to_idx[s["class_name"]]
        return tensor, label_idx

# MixUp / CutMix Implementation on GPU
def apply_mixup_cutmix(x: torch.Tensor, y: torch.Tensor, alpha_mixup=0.2, alpha_cutmix=1.0, prob=0.5):
    if np.random.rand() > prob:
        return x, y, None, 1.0

    batch_size = x.size(0)
    indices = torch.randperm(batch_size, device=x.device)
    y_b = y[indices]

    if np.random.rand() < 0.5:
        # MixUp
        lam = float(np.random.beta(alpha_mixup, alpha_mixup))
        x = lam * x + (1 - lam) * x[indices]
    else:
        # CutMix
        lam = float(np.random.beta(alpha_cutmix, alpha_cutmix))
        _, _, H, W = x.shape
        cut_rat = np.sqrt(1.0 - lam)
        cut_w = int(W * cut_rat)
        cut_h = int(H * cut_rat)

        cx = np.random.randint(W)
        cy = np.random.randint(H)

        bbx1 = np.clip(cx - cut_w // 2, 0, W)
        bby1 = np.clip(cy - cut_h // 2, 0, H)
        bbx2 = np.clip(cx + cut_w // 2, 0, W)
        bby2 = np.clip(cy + cut_h // 2, 0, H)

        x[:, :, bby1:bby2, bbx1:bbx2] = x[indices, :, bby1:bby2, bbx1:bbx2]
        lam = 1.0 - float((bbx2 - bbx1) * (bby2 - bby1) / (H * W))

    return x, y, y_b, lam

def save_training_plots(log_csv_path: str, save_png_path: str):
    """Parses log CSV and plots loss and accuracy curves."""
    if plt is None or not os.path.exists(log_csv_path):
        return
    epochs, tr_loss, val_loss, tr_acc, val_acc = [], [], [], [], []
    with open(log_csv_path, "r", encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 6:
                try:
                    epochs.append(int(parts[0]))
                    tr_loss.append(float(parts[2]))
                    tr_acc.append(float(parts[3]))
                    val_loss.append(float(parts[4]))
                    val_acc.append(float(parts[5]))
                except ValueError:
                    pass

    if not epochs:
        return

    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(epochs, tr_loss, label="Train Loss", color="royalblue")
    plt.plot(epochs, val_loss, label="Val Loss", color="crimson")
    plt.xlabel("Epoch")
    plt.ylabel("Cross-Entropy Loss")
    plt.title("Training & Validation Loss")
    plt.legend()
    plt.grid(True, alpha=0.3)

    plt.subplot(1, 2, 2)
    plt.plot(epochs, tr_acc, label="Train Acc", color="royalblue")
    plt.plot(epochs, val_acc, label="Val Acc", color="forestgreen")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy (%)")
    plt.title("Training & Validation Accuracy")
    plt.legend()
    plt.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(save_png_path, dpi=150)
    plt.close()

def evaluate(model: nn.Module, val_loader: DataLoader, criterion: nn.Module, device: torch.device, is_fast_loader: bool = False, norm_mean=None, norm_std=None) -> Tuple[float, float]:
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs = inputs.to(device, non_blocking=True).to(memory_format=torch.channels_last)
            targets = targets.to(device, non_blocking=True)
            if is_fast_loader:
                inputs = inputs.to(torch.float16).div_(255.0)
                inputs = (inputs - norm_mean) / norm_std
            with torch.amp.autocast("cuda", dtype=torch.float16):
                outputs = model(inputs)
                loss = criterion(outputs, targets)
            total_loss += loss.item() * targets.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == targets).sum().item()
            total += targets.size(0)
    return total_loss / max(total, 1), (correct / max(total, 1)) * 100.0

def main():
    parser = argparse.ArgumentParser(description="Train Custom ResNet on Dedicated GPU")
    parser.add_argument("--preset", type=str, default="base", choices=["small", "base", "large"], help="CNN preset")
    parser.add_argument("--batch_size", type=int, default=64, help="Target batch size")
    parser.add_argument("--max_epochs", type=int, default=100, help="Maximum training epochs")
    parser.add_argument("--smoke_test", action="store_true", help="Run 1 smoke-test epoch on 500 samples")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint if exists")
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader worker processes (0 is optimal for Windows in-RAM loading)")
    args = parser.parse_args()

    # Hardware check strictly inside main
    try:
        from ml.gpu_select import select_best_gpu, run_pretraining_safety_checklist, get_gpu_metrics, ThermalProtection
    except ImportError:
        from gpu_select import select_best_gpu, run_pretraining_safety_checklist, get_gpu_metrics, ThermalProtection

    gpu_info = select_best_gpu()
    device = gpu_info["device"]
    run_pretraining_safety_checklist()
    thermal_guard = ThermalProtection()

    # Load splits and classes
    with open("ml/data/train_split.json", "r", encoding="utf-8") as f:
        train_samples = json.load(f)
    with open("ml/data/val_split.json", "r", encoding="utf-8") as f:
        val_samples = json.load(f)
    with open("ml/data/classes.json", "r", encoding="utf-8") as f:
        classes = json.load(f)

    num_classes = len(classes)
    class_to_idx = {c: i for i, c in enumerate(classes)}

    print(f"\n📦 Loaded Dataset: {len(train_samples)} Train, {len(val_samples)} Val across {num_classes} classes.")

    if args.smoke_test:
        print("\n🧪 Smoke-Test Mode: Truncating to 500 samples, 1 epoch.")
        train_samples = train_samples[:500]
        val_samples = val_samples[:200]
        args.max_epochs = 1

    # Build Model
    model = build_model(num_classes=num_classes, preset=args.preset)
    model.to(device)
    model.to(memory_format=torch.channels_last)

    optimizer = optim.AdamW(model.parameters(), lr=2e-3, weight_decay=0.05)
    scaler = torch.amp.GradScaler("cuda")
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    ema = ModelEMA(model, decay=0.999)
    gpu_aug = GPUBatchAugmentation().to(device)

    os.makedirs("ml/checkpoints", exist_ok=True)
    os.makedirs("ml/results", exist_ok=True)
    last_ckpt_path = "ml/checkpoints/cnn_last.pt"
    best_ckpt_path = "ml/checkpoints/cnn_best.pt"
    log_csv_path = "ml/results/cnn_log.csv"
    plot_png_path = "ml/results/training_curves.png"

    start_epoch = 1
    best_val_acc = 0.0

    if args.resume and os.path.exists(last_ckpt_path) and not args.smoke_test:
        print(f"\n🔄 Resuming training from: {last_ckpt_path}")
        ckpt = torch.load(last_ckpt_path, map_location=device, weights_only=False)
        model.load_state_dict(ckpt["model_state_dict"])
        ema.ema_model.load_state_dict(ckpt.get("ema_state_dict", ckpt["model_state_dict"]))
        optimizer.load_state_dict(ckpt["optimizer_state_dict"])
        scaler.load_state_dict(ckpt["scaler_state_dict"])
        start_epoch = ckpt["epoch"] + 1
        best_val_acc = ckpt.get("best_val_acc", 0.0)
        print(f"   -> Resumed at Epoch {start_epoch} (Prior Best Val Acc: {best_val_acc:.2f}%)")

    # CSV Header
    if not os.path.exists(log_csv_path) or (not args.resume and start_epoch == 1):
        with open(log_csv_path, "w", encoding="utf-8") as f:
            f.write("epoch,img_size,train_loss,train_acc,val_loss,val_acc,lr,gpu_mem_mb,gpu_util_pct,gpu_temp_c,time_sec\n")

    current_img_size = None
    train_loader = None
    val_loader = None
    scheduler = None
    is_fast_loader = False

    print("\n" + "=" * 75)
    print(f"🚀 COMMENCING HIGH-THROUGHPUT CNN TRAINING ({args.preset.upper()} PRESET) ON {device}")
    print(f"   • Device:        {gpu_info['name']} ({gpu_info['vram_mb']:.1f} MB VRAM)")
    print(f"   • Pipeline:      Pre-packed uint8 memmaps + GPU Tensor Augmentations")
    print(f"   • Precision:     Mixed Precision (FP16 AMP + GradScaler)")
    print(f"   • Classes:       {num_classes}")
    print(f"   • Target Epochs: {args.max_epochs}")
    print("=" * 75 + "\n")

    patience = 20
    patience_counter = 0

    for epoch in range(start_epoch, args.max_epochs + 1):
        t0 = time.time()

        if epoch <= 35:
            new_img_size = 128
            batch_sz = args.batch_size
            accum_steps = 1
        elif epoch <= 75:
            new_img_size = 176
            batch_sz = min(args.batch_size, 48)
            accum_steps = max(1, args.batch_size // batch_sz)
        else:
            new_img_size = 224
            batch_sz = min(args.batch_size, 16)
            accum_steps = max(1, args.batch_size // batch_sz)

        if new_img_size != current_img_size:
            current_img_size = new_img_size
            print(f"\n📐 [PROGRESSIVE RESIZING] Epoch {epoch}: Switching input resolution to {current_img_size}x{current_img_size} px (Batch: {batch_sz}, Accum: {accum_steps})")
            
            # Check if fast memmaps exist
            train_mmap_fp = f"ml/data/train_{current_img_size}.npy"
            if os.path.exists(train_mmap_fp) and not args.smoke_test:
                print(f"   ⚡ Using FastMemmapDataset ({train_mmap_fp}) with GPU Augmentations")
                train_ds = FastMemmapDataset("train", current_img_size)
                val_ds = FastMemmapDataset("val", current_img_size)
                is_fast_loader = True
                kw = {"persistent_workers": True, "prefetch_factor": 2} if args.num_workers > 0 else {}
                train_loader = DataLoader(
                    train_ds, batch_size=batch_sz, shuffle=True,
                    num_workers=args.num_workers, pin_memory=True, drop_last=True,
                    collate_fn=fast_collate_fn, **kw
                )
                val_loader = DataLoader(
                    val_ds, batch_size=batch_sz, shuffle=False,
                    num_workers=args.num_workers, pin_memory=True,
                    collate_fn=fast_collate_fn, **kw
                )
            else:
                print(f"   📂 Using CachedFoodDataset for {current_img_size}px")
                is_fast_loader = False
                train_ds = CachedFoodDataset(train_samples, current_img_size, class_to_idx, is_training=True)
                val_ds = CachedFoodDataset(val_samples, current_img_size, class_to_idx, is_training=False)
                train_loader = DataLoader(
                    train_ds, batch_size=batch_sz, shuffle=True,
                    num_workers=args.num_workers, pin_memory=True, drop_last=True
                )
                val_loader = DataLoader(
                    val_ds, batch_size=batch_sz, shuffle=False,
                    num_workers=args.num_workers, pin_memory=True
                )

            total_steps = len(train_loader) * (args.max_epochs - epoch + 1) // accum_steps
            scheduler = CosineAnnealingLR(optimizer, T_max=max(total_steps, 100), eta_min=1e-5)

        # Training Phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        optimizer.zero_grad(set_to_none=True)

        batch_times = []
        for step, (inputs, targets) in enumerate(train_loader):
            step_t0 = time.perf_counter()
            inputs = inputs.to(device, non_blocking=True).to(memory_format=torch.channels_last)
            targets = targets.to(device, non_blocking=True)

            if is_fast_loader:
                inputs = gpu_aug(inputs, is_training=True)

            inputs_mixed, y_a, y_b, lam = apply_mixup_cutmix(inputs, targets)

            try:
                with torch.amp.autocast("cuda", dtype=torch.float16):
                    outputs = model(inputs_mixed)
                    if y_b is not None:
                        loss = lam * criterion(outputs, y_a) + (1.0 - lam) * criterion(outputs, y_b)
                    else:
                        loss = criterion(outputs, targets)
                    loss = loss / accum_steps

                scaler.scale(loss).backward()
            except (torch.cuda.OutOfMemoryError, RuntimeError) as e:
                err_msg = str(e).lower()
                if "out of memory" in err_msg or "cuda out of memory" in err_msg:
                    print(f"\n   ⚠️ [OOM Caught] Batch size {inputs.size(0)} caused VRAM exhaustion! Halving into micro-batches...", flush=True)
                    torch.cuda.empty_cache()
                    half = inputs.size(0) // 2
                    if half == 0:
                        raise e
                    sub_accum = accum_steps * 2
                    
                    # Sub-batch 1
                    with torch.amp.autocast("cuda", dtype=torch.float16):
                        out1 = model(inputs_mixed[:half])
                        loss1 = (criterion(out1, targets[:half])) / sub_accum
                    scaler.scale(loss1).backward()
                    
                    # Sub-batch 2
                    with torch.amp.autocast("cuda", dtype=torch.float16):
                        out2 = model(inputs_mixed[half:])
                        loss2 = (criterion(out2, targets[half:])) / sub_accum
                    scaler.scale(loss2).backward()
                    
                    outputs = torch.cat([out1, out2], dim=0)
                    loss = (loss1 + loss2) * (sub_accum / accum_steps)
                    print(f"   ✅ Recovered from OOM seamlessly via adaptive micro-batch halving.", flush=True)
                else:
                    raise e

            if (step + 1) % accum_steps == 0 or (step + 1) == len(train_loader):
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad(set_to_none=True)
                ema.update(model)
                if scheduler:
                    scheduler.step()

            train_loss += loss.item() * accum_steps * targets.size(0)
            preds = outputs.argmax(dim=1)
            train_correct += (preds == targets).sum().item()
            train_total += targets.size(0)

            step_dur = time.perf_counter() - step_t0
            batch_times.append(step_dur)

            # Print first 3 consecutive batches of first resumed epoch for proof check
            if step < 3:
                print(f"   [Epoch {epoch:03d}/{args.max_epochs}] Batch {step+1:03d}/{len(train_loader)} | Batch Time: {step_dur*1000:.1f} ms ({1.0/max(step_dur, 1e-4):.2f} batch/s) | Loss: {loss.item()*accum_steps:.4f}", flush=True)

            if (step + 1) % 50 == 0 or (step + 1) == len(train_loader):
                elapsed = time.time() - t0
                speed = (step + 1) / max(elapsed, 0.01)
                rem_sec = (len(train_loader) - (step + 1)) / max(speed, 0.01)
                print(f"   [Epoch {epoch:03d}/{args.max_epochs}] Step {step+1:03d}/{len(train_loader)} | Batch Loss: {loss.item()*accum_steps:.4f} | Speed: {speed:.1f} batch/s | ETA: {rem_sec:.0f}s", flush=True)

        epoch_train_loss = train_loss / max(train_total, 1)
        epoch_train_acc = (train_correct / max(train_total, 1)) * 100.0

        # Validation Phase
        norm_mean = gpu_aug.mean if is_fast_loader else None
        norm_std = gpu_aug.std if is_fast_loader else None
        raw_val_loss, raw_val_acc = evaluate(model, val_loader, criterion, device, is_fast_loader, norm_mean, norm_std)
        ema_val_loss, ema_val_acc = evaluate(ema.ema_model, val_loader, criterion, device, is_fast_loader, norm_mean, norm_std)

        if ema_val_acc >= raw_val_acc:
            val_loss, val_acc = ema_val_loss, ema_val_acc
            chosen_weights = ema.ema_model.state_dict()
            eval_source = "EMA"
        else:
            val_loss, val_acc = raw_val_loss, raw_val_acc
            chosen_weights = model.state_dict()
            eval_source = "RAW"

        epoch_time = time.time() - t0
        current_lr = optimizer.param_groups[0]["lr"]
        metrics = get_gpu_metrics()

        # Split Leakage Guard (<15 epochs & ~100% acc)
        if epoch <= 15 and val_acc >= 99.0:
            print(f"\n⚠️ WARNING: Validation accuracy reached {val_acc:.2f}% at epoch {epoch}! Inspecting for possible split leakage...")

        with open(log_csv_path, "a", encoding="utf-8") as f:
            f.write(f"{epoch},{current_img_size},{epoch_train_loss:.4f},{epoch_train_acc:.2f},{val_loss:.4f},{val_acc:.2f},{current_lr:.6f},{metrics['mem_used_mb']:.1f},{metrics['util_percent']:.1f},{metrics['temp_c']:.1f},{epoch_time:.2f}\n")

        print(
            f"Epoch [{epoch:>3}/{args.max_epochs}] ({current_img_size}px) | "
            f"Train Loss: {epoch_train_loss:.4f} Acc: {epoch_train_acc:>5.2f}% | "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc:>5.2f}% ({eval_source}) | "
            f"GPU: {metrics['util_percent']:>4.1f}% ({metrics['temp_c']}°C) | "
            f"Time: {epoch_time:>5.1f}s"
        )

        is_best = val_acc > best_val_acc
        if is_best:
            best_val_acc = val_acc
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": chosen_weights,
                "classes": classes,
                "num_classes": num_classes,
                "preset": args.preset,
                "best_val_acc": best_val_acc,
                "val_loss": val_loss
            }, best_ckpt_path)
            print(f"   ⭐ New Best Model Checkpoint Saved! (Val Acc: {best_val_acc:.2f}%)")
        else:
            if epoch >= 60:
                patience_counter += 1

        torch.save({
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "ema_state_dict": ema.ema_model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scaler_state_dict": scaler.state_dict(),
            "classes": classes,
            "best_val_acc": best_val_acc,
            "epoch_val_acc": val_acc
        }, last_ckpt_path)

        save_training_plots(log_csv_path, plot_png_path)
        thermal_guard.check(on_save_checkpoint_fn=lambda: torch.save(model.state_dict(), last_ckpt_path))

        if patience_counter >= patience and epoch >= 60:
            print(f"\n🛑 Early stopping triggered at Epoch {epoch} (No improvement for {patience} epochs).")
            break

    print(f"\n🏁 CNN Training Completed! Peak Validation Accuracy: {best_val_acc:.2f}%")
    print(f"   Best Checkpoint: {best_ckpt_path}")

if __name__ == "__main__":
    main()
