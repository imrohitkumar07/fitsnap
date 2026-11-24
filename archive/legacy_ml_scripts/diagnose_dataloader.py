"""
diagnose_dataloader.py
Diagnoses data loading throughput vs GPU compute throughput for Custom ResNet.
"""

import os
import sys
import time
import json
import psutil
import torch
from pathlib import Path

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from models.resnet_custom import build_model
from train_cnn import CachedFoodDataset, DataLoader, apply_mixup_cutmix

def run_diagnostics():
    print("=" * 75)
    print("🔍 FITSNAP HARDWARE & DATALOADER DIAGNOSTICS")
    print("=" * 75)

    # 1. CPU & RAM
    phys_cores = psutil.cpu_count(logical=False)
    log_cores = psutil.cpu_count(logical=True)
    vmem = psutil.virtual_memory()
    total_ram_gb = vmem.total / (1024 ** 3)
    avail_ram_gb = vmem.available / (1024 ** 3)

    print(f"\n[1. CPU & RAM SPECIFICATIONS]")
    print(f"  • CPU Physical Cores:  {phys_cores}")
    print(f"  • CPU Logical Threads: {log_cores}")
    print(f"  • Total System RAM:    {total_ram_gb:.2f} GB")
    print(f"  • Available RAM:       {avail_ram_gb:.2f} GB")

    # 2. Current DataLoader Settings in train_cnn.py
    print(f"\n[2. CURRENT DATALOADER SETTINGS IN TRAIN_CNN.PY]")
    print(f"  • num_workers:         0  (Single main-thread on Windows)")
    print(f"  • pin_memory:          True")
    print(f"  • persistent_workers:  False (default for num_workers=0)")
    print(f"  • prefetch_factor:     None  (default for num_workers=0)")
    print(f"  • batch_size:          64")

    # 3. Data Storage & Cache Path Inspection
    with open(DATA_DIR / "train_split.json", "r", encoding="utf-8") as f:
        train_samples = json.load(f)
    with open(DATA_DIR / "classes.json", "r", encoding="utf-8") as f:
        classes = json.load(f)
    class_to_idx = {c: i for i, c in enumerate(classes)}

    sample_0 = train_samples[0]
    cache_id = sample_0.get("md5", sample_0.get("cache_id"))
    cached_128_path = BASE_DIR / "data" / "cache" / "128" / f"{cache_id}.jpg"
    cache_exists = cached_128_path.exists()
    cache_sz_bytes = cached_128_path.stat().st_size if cache_exists else 0

    print(f"\n[3. DATA STORAGE & FORMAT]")
    print(f"  • Read Source:         Individual JPEG files from disk pre-resized cache ({cached_128_path.parent})")
    print(f"  • Cache resolution:    128x128 JPEG files (~{cache_sz_bytes / 1024:.1f} KB per file)")
    print(f"  • Disk I/O overhead:   {len(train_samples):,} separate file open() + libjpeg decode operations per epoch")

    # 4. CPU vs GPU Augmentation Pipeline
    print(f"\n[4. AUGMENTATION BREAKDOWN]")
    print(f"  • CPU Augmentations (Per-Sample PIL & Torchvision):")
    print(f"      - T.RandomResizedCrop(128, scale=(0.35, 1.0))")
    print(f"      - T.RandomHorizontalFlip(p=0.5)")
    print(f"      - T.RandomRotation(degrees=15)")
    print(f"      - T.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15)")
    print(f"      - T.RandAugment(num_ops=2, magnitude=7)  <-- [VERY HEAVY on CPU!]")
    print(f"      - T.ToTensor()")
    print(f"      - T.Normalize(mean, std)")
    print(f"      - T.RandomErasing(p=0.2, scale=(0.02, 0.25))")
    print(f"  • GPU Operations:")
    print(f"      - CutMix & MixUp (apply_mixup_cutmix on GPU tensor batch)")
    print(f"      - Model forward pass (FP16 AMP)")
    print(f"      - Loss backward + AdamW step")

    # 5. Timing One Batch Breakdown
    print(f"\n[5. TIMING BENCHMARK: DATA LOADING VS GPU COMPUTE (BATCH SIZE 64)]")
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    ds = CachedFoodDataset(train_samples[:512], img_size=128, class_to_idx=class_to_idx, is_training=True)
    loader = DataLoader(ds, batch_size=64, shuffle=False, num_workers=0, pin_memory=True)

    model = build_model(num_classes=len(classes), preset="base").to(device)
    model.to(memory_format=torch.channels_last)
    model.train()
    criterion = torch.nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scaler = torch.amp.GradScaler("cuda")

    # Warmup
    loader_iter = iter(loader)
    warmup_x, warmup_y = next(loader_iter)
    warmup_x = warmup_x.to(device, non_blocking=True).to(memory_format=torch.channels_last)
    warmup_y = warmup_y.to(device, non_blocking=True)
    with torch.amp.autocast("cuda"):
        w_out = model(warmup_x)
        w_loss = criterion(w_out, warmup_y)
    scaler.scale(w_loss).backward()
    scaler.step(optimizer)
    scaler.update()
    optimizer.zero_grad(set_to_none=True)
    torch.cuda.synchronize()

    # Benchmark 3 batches
    data_times = []
    gpu_times = []
    transfer_times = []

    for _ in range(3):
        t_data_0 = time.perf_counter()
        inputs, targets = next(loader_iter)
        t_data_1 = time.perf_counter()
        data_times.append(t_data_1 - t_data_0)

        t_trans_0 = time.perf_counter()
        inputs = inputs.to(device, non_blocking=True).to(memory_format=torch.channels_last)
        targets = targets.to(device, non_blocking=True)
        torch.cuda.synchronize()
        t_trans_1 = time.perf_counter()
        transfer_times.append(t_trans_1 - t_trans_0)

        t_gpu_0 = time.perf_counter()
        inputs_mixed, y_a, y_b, lam = apply_mixup_cutmix(inputs, targets)
        with torch.amp.autocast("cuda", dtype=torch.float16):
            outputs = model(inputs_mixed)
            if y_b is not None:
                loss = lam * criterion(outputs, y_a) + (1.0 - lam) * criterion(outputs, y_b)
            else:
                loss = criterion(outputs, targets)
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad(set_to_none=True)
        torch.cuda.synchronize()
        t_gpu_1 = time.perf_counter()
        gpu_times.append(t_gpu_1 - t_gpu_0)

    avg_data = sum(data_times) / len(data_times)
    avg_trans = sum(transfer_times) / len(transfer_times)
    avg_gpu = sum(gpu_times) / len(gpu_times)
    total_batch_time = avg_data + avg_trans + avg_gpu

    print(f"  • CPU Data Loading + Augmentation (64 imgs): {avg_data * 1000:6.1f} ms ({avg_data / total_batch_time * 100:4.1f}% of cycle)")
    print(f"  • Host-to-Device Memory Transfer:             {avg_trans * 1000:6.1f} ms ({avg_trans / total_batch_time * 100:4.1f}% of cycle)")
    print(f"  • GPU Forward + Backward + Optimizer:        {avg_gpu * 1000:6.1f} ms ({avg_gpu / total_batch_time * 100:4.1f}% of cycle)")
    print(f"  • Total Time Per Batch:                      {total_batch_time * 1000:6.1f} ms (Throughput: {1.0 / total_batch_time:.2f} batch/s)")

    print("\n" + "=" * 75)
    print("🚨 BOTTLENECK CONCLUSION:")
    print(f"   CPU Data Loading accounts for {avg_data / total_batch_time * 100:.1f}% of total batch time!")
    print(f"   The GPU sits IDLE for {(avg_data / total_batch_time) * 100:.1f}% of the time waiting for CPU PIL")
    print(f"   JPEG decoding and RandAugment transformations.")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    run_diagnostics()
