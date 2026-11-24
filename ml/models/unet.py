"""
unet.py
4-Level U-Net Architecture written from scratch in PyTorch (Module 3).
Features:
- Encoder-Decoder with skip connections
- Channel depths: 32 -> 64 -> 128 -> 256 -> 512 (Bottleneck) -> 256 -> 128 -> 64 -> 32
- DoubleConv blocks (Conv2d -> BatchNorm2d -> SiLU -> Conv2d -> BatchNorm2d -> SiLU)
- Transposed Convolution upsampling
- Outputs single-channel food mask logits (or 3-class background, plate, food)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class DoubleConv(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)

class UNet(nn.Module):
    def __init__(self, in_channels: int = 3, out_channels: int = 1, base_channels: int = 32):
        super().__init__()
        # Encoder
        self.enc1 = DoubleConv(in_channels, base_channels)        # -> 32
        self.pool1 = nn.MaxPool2d(2)

        self.enc2 = DoubleConv(base_channels, base_channels * 2)   # -> 64
        self.pool2 = nn.MaxPool2d(2)

        self.enc3 = DoubleConv(base_channels * 2, base_channels * 4) # -> 128
        self.pool3 = nn.MaxPool2d(2)

        self.enc4 = DoubleConv(base_channels * 4, base_channels * 8) # -> 256
        self.pool4 = nn.MaxPool2d(2)

        # Bottleneck
        self.bottleneck = DoubleConv(base_channels * 8, base_channels * 16) # -> 512

        # Decoder with Skip Connections
        self.up4 = nn.ConvTranspose2d(base_channels * 16, base_channels * 8, kernel_size=2, stride=2)
        self.dec4 = DoubleConv(base_channels * 16, base_channels * 8)

        self.up3 = nn.ConvTranspose2d(base_channels * 8, base_channels * 4, kernel_size=2, stride=2)
        self.dec3 = DoubleConv(base_channels * 8, base_channels * 4)

        self.up2 = nn.ConvTranspose2d(base_channels * 4, base_channels * 2, kernel_size=2, stride=2)
        self.dec2 = DoubleConv(base_channels * 4, base_channels * 2)

        self.up1 = nn.ConvTranspose2d(base_channels * 2, base_channels, kernel_size=2, stride=2)
        self.dec1 = DoubleConv(base_channels * 2, base_channels)

        # Final 1x1 Conv
        self.out_conv = nn.Conv2d(base_channels, out_channels, kernel_size=1)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Encoder
        s1 = self.enc1(x)
        p1 = self.pool1(s1)

        s2 = self.enc2(p1)
        p2 = self.pool2(s2)

        s3 = self.enc3(p2)
        p3 = self.pool3(s3)

        s4 = self.enc4(p3)
        p4 = self.pool4(s4)

        # Bottleneck
        b = self.bottleneck(p4)

        # Decoder with Skips
        d4 = self.up4(b)
        d4 = torch.cat([d4, s4], dim=1)
        d4 = self.dec4(d4)

        d3 = self.up3(d4)
        d3 = torch.cat([d3, s3], dim=1)
        d3 = self.dec3(d3)

        d2 = self.up2(d3)
        d2 = torch.cat([d2, s2], dim=1)
        d2 = self.dec2(d2)

        d1 = self.up1(d2)
        d1 = torch.cat([d1, s1], dim=1)
        d1 = self.dec1(d1)

        return self.out_conv(d1)

def build_unet(in_channels: int = 3, out_channels: int = 1, base_channels: int = 32) -> UNet:
    model = UNet(in_channels=in_channels, out_channels=out_channels, base_channels=base_channels)
    params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Built 4-Level U-Net: {params / 1e6:.2f}M parameters ({params:,} weights).")
    return model

if __name__ == "__main__":
    net = build_unet()
    x = torch.randn(2, 3, 256, 256)
    y = net(x)
    assert y.shape == (2, 1, 256, 256)
    print(f"U-Net forward output shape: {y.shape} (Passed)")
