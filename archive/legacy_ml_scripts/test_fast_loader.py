"""
test_fast_loader.py
Benchmarks the new FastMemmapDataset + GPU Augmentation pipeline.
"""

import os
import sys
import time

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
except Exception:
    pass

import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import Dataset, DataLoader

class FastMemmapDataset(Dataset):
    def __init__(self, split_name: str, img_size: int = 128):
        self.img_size = img_size
        npy_path = f"ml/data/{split_name}_{img_size}.npy"
        lbl_path = f"ml/data/{split_name}_{img_size}_labels.npy"
        self.images = np.load(npy_path, mmap_mode="r")
        self.labels = np.load(lbl_path)
        self.length = len(self.labels)

    def __len__(self):
        return self.length

    def __getitem__(self, idx):
        return self.images[idx], self.labels[idx]

def fast_collate_fn(batch):
    imgs, lbls = zip(*batch)
    imgs_tensor = torch.from_numpy(np.stack(imgs))
    lbls_tensor = torch.tensor(lbls, dtype=torch.int64)
    # Permute from (B, H, W, C) to (B, C, H, W)
    imgs_tensor = imgs_tensor.permute(0, 3, 1, 2).contiguous()
    return imgs_tensor, lbls_tensor

class GPUAugmentation(nn.Module):
    def __init__(self):
        super().__init__()
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    @torch.no_grad()
    def forward(self, x: torch.Tensor, is_training: bool = True) -> torch.Tensor:
        # x is (B, 3, H, W) uint8 on GPU
        x = x.to(torch.float16).div_(255.0)
        if is_training:
            B, C, H, W = x.shape
            # Fast Random Flip
            flip = torch.rand(B, 1, 1, 1, device=x.device) > 0.5
            x = torch.where(flip, torch.flip(x, dims=[-1]), x)
            # Fast Random Brightness
            if torch.rand(1).item() > 0.5:
                gain = 1.0 + (torch.rand(B, 1, 1, 1, device=x.device) - 0.5) * 0.3
                x = torch.clamp(x * gain, 0.0, 1.0)
        # Normalize
        x = (x - self.mean) / self.std
        return x

def benchmark_fast_pipeline():
    print("Benchmarking Fast Pipeline...")
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    ds = FastMemmapDataset("train", 128)
    loader = DataLoader(
        ds, batch_size=64, shuffle=True,
        num_workers=4, pin_memory=True,
        persistent_workers=True, prefetch_factor=2,
        collate_fn=fast_collate_fn
    )
    gpu_aug = GPUAugmentation().to(device)

    sys.path.insert(0, "ml")
    from models.resnet_custom import build_model
    model = build_model(272, preset="base").to(device)
    model.to(memory_format=torch.channels_last)
    model.train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scaler = torch.amp.GradScaler("cuda")
    criterion = nn.CrossEntropyLoss()

    loader_iter = iter(loader)
    # Warmup
    x, y = next(loader_iter)
    x = x.to(device, non_blocking=True).to(memory_format=torch.channels_last)
    y = y.to(device, non_blocking=True)
    x = gpu_aug(x, is_training=True)
    with torch.amp.autocast("cuda", dtype=torch.float16):
        out = model(x)
        loss = criterion(out, y)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
    optimizer.zero_grad(set_to_none=True)
    torch.cuda.synchronize()

    times = []
    for step in range(5):
        t0 = time.perf_counter()
        x, y = next(loader_iter)
        x = x.to(device, non_blocking=True).to(memory_format=torch.channels_last)
        y = y.to(device, non_blocking=True)
        x = gpu_aug(x, is_training=True)
        with torch.amp.autocast("cuda", dtype=torch.float16):
            out = model(x)
            loss = criterion(out, y)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad(set_to_none=True)
        torch.cuda.synchronize()
        dur = time.perf_counter() - t0
        times.append(dur)
        print(f"Batch {step+1}: {dur*1000:.1f} ms ({1.0/dur:.2f} batch/s) | Loss: {loss.item():.4f}")

    avg = sum(times) / len(times)
    print(f"\nAverage Batch Time: {avg*1000:.1f} ms | Throughput: {1.0/avg:.2f} batch/s")
    print(f"Estimated Epoch Time (376 batches): {376 * avg:.1f} seconds (~{376 * avg / 60:.1f} minutes)!")

if __name__ == "__main__":
    benchmark_fast_pipeline()
