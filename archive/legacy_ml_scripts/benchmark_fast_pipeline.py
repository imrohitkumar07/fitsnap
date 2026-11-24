"""
ml/benchmark_fast_pipeline.py
Tests throughput of FastMemmapDataset with different worker counts and measures GPU utilization.
"""

import sys
import time
from pathlib import Path
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fast_loader import FastMemmapDataset, fast_collate_fn, GPUBatchAugmentation
from models.resnet_custom import build_model
from train_cnn import apply_mixup_cutmix

def run_benchmark():
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Hardware Device: {device} ({torch.cuda.get_device_name(0)})")
    torch.backends.cudnn.benchmark = True

    model = build_model(num_classes=272, preset="base").to(device)
    model.to(memory_format=torch.channels_last)
    model.train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scaler = torch.amp.GradScaler("cuda")
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    gpu_aug = GPUBatchAugmentation().to(device)

    for nw in [0, 2, 4]:
        print(f"\n--- Testing num_workers = {nw} ---")
        ds = FastMemmapDataset("train", 128)
        kw = {"persistent_workers": True, "prefetch_factor": 2} if nw > 0 else {}
        loader = DataLoader(
            ds, batch_size=64, shuffle=True,
            num_workers=nw, pin_memory=True,
            collate_fn=fast_collate_fn,
            drop_last=True, **kw
        )

        it = iter(loader)
        # Warmup 3 batches
        for _ in range(3):
            x, y = next(it)
            x = x.to(device, non_blocking=True).to(memory_format=torch.channels_last)
            y = y.to(device, non_blocking=True)
            x = gpu_aug(x, is_training=True)
            x_m, ya, yb, lam = apply_mixup_cutmix(x, y)
            with torch.amp.autocast("cuda", dtype=torch.float16):
                out = model(x_m)
                loss = lam * criterion(out, ya) + (1.0 - lam) * criterion(out, yb) if yb is not None else criterion(out, ya)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
        torch.cuda.synchronize()

        # Benchmark 10 batches
        t0 = time.perf_counter()
        times = []
        for step in range(10):
            bt0 = time.perf_counter()
            x, y = next(it)
            x = x.to(device, non_blocking=True).to(memory_format=torch.channels_last)
            y = y.to(device, non_blocking=True)
            x = gpu_aug(x, is_training=True)
            x_m, ya, yb, lam = apply_mixup_cutmix(x, y)
            with torch.amp.autocast("cuda", dtype=torch.float16):
                out = model(x_m)
                loss = lam * criterion(out, ya) + (1.0 - lam) * criterion(out, yb) if yb is not None else criterion(out, ya)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
            torch.cuda.synchronize()
            bdur = time.perf_counter() - bt0
            times.append(bdur)

        total_time = time.perf_counter() - t0
        avg_batch_ms = (total_time / 10) * 1000
        throughput = 10 / total_time
        epoch_sec = 376 * (total_time / 10)
        print(f"Result for num_workers={nw}:")
        print(f"  • Avg batch time: {avg_batch_ms:.1f} ms")
        print(f"  • Throughput:     {throughput:.2f} batch/s")
        print(f"  • Est. Epoch (376 batches): {epoch_sec:.1f}s (~{epoch_sec/60:.2f} min)")

if __name__ == "__main__":
    run_benchmark()
