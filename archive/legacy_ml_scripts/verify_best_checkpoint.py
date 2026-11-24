"""
ml/verify_best_checkpoint.py
Prints final CNN training results from cnn_best.pt and cnn_log.csv.
"""

import sys
import torch
import pandas as pd

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ckpt = torch.load("ml/checkpoints/cnn_best.pt", map_location="cpu", weights_only=False)
print("=" * 60)
print("[BEST] FITSNAP CUSTOM RESNET-34 (BASE) FINAL RESULTS")
print("=" * 60)
print(f"• Best Validation Epoch:    Epoch {ckpt.get('epoch')} / 100")
print(f"• Peak Validation Accuracy: {ckpt.get('best_val_acc'):.2f}%")
print(f"• Best Validation Loss:     {ckpt.get('val_loss'):.4f}")
print(f"• Unified Food Classes:     {ckpt.get('num_classes')}")
print(f"• Preset:                   {ckpt.get('preset')}")
print(f"• Architecture:             Custom ResNet-34 + SE Attention + SiLU")
print(f"• Weights Initialized:      Random Kaiming (Zero Pretrained)")
print(f"• Checkpoint File:          ml/checkpoints/cnn_best.pt (86.6 MB)")
print("=" * 60)

# Check epoch summary
df = pd.read_csv("ml/results/cnn_log.csv")
print(f"• Total Epochs Run:         {len(df)}")
print(f"• Total Training Time:      {df['time_sec'].sum() / 3600:.2f} hours")
print(f"• Final Epoch 100 Acc:      Train {df.iloc[-1]['train_acc']:.2f}% | Val {df.iloc[-1]['val_acc']:.2f}%")
print("=" * 60)
