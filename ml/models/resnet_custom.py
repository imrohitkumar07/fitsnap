"""
resnet_custom.py
Custom ResNet-Style CNN Food Classifier written in PyTorch from scratch (Module 1).
Features:
- Residual Blocks with SiLU activations and BatchNorm
- Squeeze-and-Excitation (SE) channel attention
- Stochastic Depth (DropPath)
- Global Average Pooling (GAP) + Dropout + Linear Head
- Presets: small (~2.1M), base (~11.2M), large (~25.5M)
- Kaiming Normal init with zero-init on the last BatchNorm gamma
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F

class SqueezeExcitation(nn.Module):
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
    """Drop paths (Stochastic Depth) per sample (when applied in main path of residual blocks)."""
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
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        stride: int = 1,
        use_se: bool = True,
        drop_path: float = 0.0
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
                nn.BatchNorm2d(out_channels)
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
    def __init__(
        self,
        num_classes: int = 34,
        preset: str = "small",
        dropout_rate: float = 0.2,
        drop_path_rate: float = 0.1,
        use_se: bool = True
    ):
        super().__init__()
        self.preset = preset

        configs = {
            "small": {
                "stem_channels": 32,
                "stage_channels": [32, 64, 128, 256],
                "stage_depths": [2, 2, 2, 2],
            },
            "base": {
                "stem_channels": 64,
                "stage_channels": [64, 128, 256, 512],
                "stage_depths": [3, 4, 6, 3],
            },
            "large": {
                "stem_channels": 64,
                "stage_channels": [64, 128, 256, 512],
                "stage_depths": [3, 4, 18, 3],
            }
        }

        if preset not in configs:
            raise ValueError(f"Unknown preset: {preset}. Choose from 'small', 'base', 'large'.")

        cfg = configs[preset]
        stem_ch = cfg["stem_channels"]
        channels = cfg["stage_channels"]
        depths = cfg["stage_depths"]

        # Stem
        self.stem = nn.Sequential(
            nn.Conv2d(3, stem_ch, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(stem_ch),
            nn.SiLU(inplace=True),
            nn.Conv2d(stem_ch, stem_ch, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(stem_ch),
            nn.SiLU(inplace=True)
        )

        # Stochastic depth decay rule
        total_blocks = sum(depths)
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, total_blocks)]

        # 4 Residual Stages
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
                        drop_path=dpr[block_idx]
                    )
                )
                block_idx += 1
            self.stages.append(nn.Sequential(*blocks))
            in_ch = out_ch

        self.last_conv_stage = self.stages[-1] # Target for Grad-CAM

        # Head
        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(p=dropout_rate)
        self.classifier = nn.Linear(channels[-1], num_classes)

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                nn.init.constant_(m.bias, 0)

        # Zero-initialize the last BN in each residual branch (fix identity on init)
        for m in self.modules():
            if isinstance(m, ResidualBlock):
                nn.init.constant_(m.bn2.weight, 0)

    def forward_features(self, x: torch.Tensor) -> torch.Tensor:
        x = self.stem(x)
        for stage in self.stages:
            x = stage(x)
        return x

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.forward_features(x)
        pooled = self.gap(feat).flatten(1)
        dropped = self.dropout(pooled)
        out = self.classifier(dropped)
        return out

def build_model(num_classes: int = 34, preset: str = "small", **kwargs) -> CustomResNet:
    model = CustomResNet(num_classes=num_classes, preset=preset, **kwargs)
    param_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Built CustomResNet ({preset}): {param_count / 1e6:.2f}M parameters ({param_count:,} weights).")
    return model

if __name__ == "__main__":
    for p in ["small", "base", "large"]:
        m = build_model(34, p)
        x = torch.randn(2, 3, 224, 224)
        y = m(x)
        assert y.shape == (2, 34)
        print(f"  -> Forward shape for {p}: {y.shape} (Passed)\n")
