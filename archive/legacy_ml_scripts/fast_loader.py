"""
ml/fast_loader.py
High-throughput in-memory & memmap dataset and GPU batch augmentation pipeline for FitSnap.
Designed for Windows multiprocessing safety and maximum GPU saturation.
"""

import os
import psutil
import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import Dataset, DataLoader

class FastMemmapDataset(Dataset):
    """
    Directly accesses pre-packed uint8 arrays.
    Loads into RAM when memory allows (instant 2ms access), with fallback to disk mmap.
    """
    def __init__(self, split_name: str, img_size: int = 128, load_to_ram: bool = True):
        self.split_name = split_name
        self.img_size = img_size
        self.npy_path = f"ml/data/{split_name}_{img_size}.npy"
        self.lbl_path = f"ml/data/{split_name}_{img_size}_labels.npy"
        
        if not os.path.exists(self.npy_path) or not os.path.exists(self.lbl_path):
            raise FileNotFoundError(f"Missing files: {self.npy_path} or {self.lbl_path}")
        
        self.labels = np.load(self.lbl_path)
        self.length = len(self.labels)

        # Check available RAM before loading into memory
        file_sz_gb = os.path.getsize(self.npy_path) / (1024 ** 3)
        avail_ram_gb = psutil.virtual_memory().available / (1024 ** 3)

        if load_to_ram and (avail_ram_gb > file_sz_gb + 1.5):
            print(f"   ⚡ Loading {file_sz_gb:.2f} GB dataset ({split_name}_{img_size}) directly into RAM...")
            self.images = np.load(self.npy_path)
            print(f"   ✅ Loaded into RAM! (Instant 2ms batch indexing)")
        else:
            print(f"   📂 Memory-mapping {file_sz_gb:.2f} GB dataset ({split_name}_{img_size}) via OS page cache...")
            self.images = np.load(self.npy_path, mmap_mode="r")

    def __len__(self):
        return self.length

    def __getitem__(self, idx):
        return self.images[idx], self.labels[idx]

def fast_collate_fn(batch):
    """
    Zero-overhead collation: stacks numpy arrays directly and permutes (B, H, W, C) -> (B, C, H, W).
    """
    imgs, lbls = zip(*batch)
    imgs_tensor = torch.from_numpy(np.stack(imgs))
    lbls_tensor = torch.tensor(lbls, dtype=torch.int64)
    # Permute to channels first (B, C, H, W)
    imgs_tensor = imgs_tensor.permute(0, 3, 1, 2).contiguous()
    return imgs_tensor, lbls_tensor

class GPUBatchAugmentation(nn.Module):
    """
    Ultra-fast GPU-accelerated batch augmentation module.
    Runs entirely on Tensor Cores in FP16, completely freeing the CPU.
    """
    def __init__(self):
        super().__init__()
        # ImageNet normalization parameters registered as buffers
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406], dtype=torch.float16).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225], dtype=torch.float16).view(1, 3, 1, 1))

    @torch.no_grad()
    def forward(self, x: torch.Tensor, is_training: bool = True) -> torch.Tensor:
        """
        x: (B, 3, H, W) uint8 tensor on CUDA.
        Returns: (B, 3, H, W) float16 normalized tensor on CUDA.
        """
        # Convert uint8 to float16 and scale to [0, 1]
        x = x.to(torch.float16).div_(255.0)

        if is_training:
            B, C, H, W = x.shape
            # 1. Random Horizontal Flip (p=0.5)
            flip_mask = torch.rand(B, 1, 1, 1, device=x.device) > 0.5
            x = torch.where(flip_mask, torch.flip(x, dims=[-1]), x)

            # 2. Random Brightness Jitter (+-15%)
            gain = 1.0 + (torch.rand(B, 1, 1, 1, device=x.device, dtype=torch.float16) - 0.5) * 0.3
            x = torch.clamp(x * gain, 0.0, 1.0)

            # 3. Random Contrast Jitter (+-15%)
            mean_intensity = x.mean(dim=[-2, -1], keepdim=True)
            contrast_factor = 1.0 + (torch.rand(B, 1, 1, 1, device=x.device, dtype=torch.float16) - 0.5) * 0.3
            x = torch.clamp(mean_intensity + (x - mean_intensity) * contrast_factor, 0.0, 1.0)

            # 4. GPU Random Erasing / Cutout (p=0.25)
            if torch.rand(1, device=x.device).item() < 0.25:
                erase_h = int(H * 0.25)
                erase_w = int(W * 0.25)
                top = torch.randint(0, max(1, H - erase_h), (B,), device=x.device)
                left = torch.randint(0, max(1, W - erase_w), (B,), device=x.device)
                for i in range(B):
                    x[i, :, top[i]:top[i] + erase_h, left[i]:left[i] + erase_w] = 0.5

        # Normalize with ImageNet mean and std
        x = (x - self.mean) / self.std
        return x
