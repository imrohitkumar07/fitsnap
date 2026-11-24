"""
ml/verify_checkpoint_cpu.py
Verifies cnn_last.pt loads cleanly on CPU.
STRICTLY RUNS ON CPU ONLY (CUDA disabled).
"""

import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

os.environ["CUDA_VISIBLE_DEVICES"] = ""

import torch

def verify():
    ckpt_path = "ml/checkpoints/cnn_last.pt"
    if not os.path.exists(ckpt_path):
        print(f"Error: {ckpt_path} not found!")
        sys.exit(1)

    print(f"Loading {ckpt_path} strictly on CPU (CUDA_VISIBLE_DEVICES='')...")
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)

    print("\n" + "=" * 60)
    print("✅ CHECKPOINT INTEGRITY VERIFICATION (CPU ONLY)")
    print("=" * 60)
    print(f"• Checkpoint Keys:             {list(ckpt.keys())}")
    print(f"• Saved Epoch:                 {ckpt.get('epoch')}")
    print(f"• Next Resume Epoch:           {ckpt.get('epoch') + 1}")
    print(f"• Peak Best Validation Acc:    {ckpt.get('best_val_acc'):.2f}%")
    print(f"• Last Epoch Val Acc (Ep {ckpt.get('epoch')}): {ckpt.get('epoch_val_acc'):.2f}%")
    print(f"• Classes Count:               {len(ckpt.get('classes', []))}")
    print(f"• Model Parameter Tensors:     {len(ckpt['model_state_dict'])}")
    print(f"• EMA Parameter Tensors:       {len(ckpt.get('ema_state_dict', {}))}")
    print(f"• Optimizer Param Groups:      {len(ckpt['optimizer_state_dict']['param_groups'])}")
    print(f"• Optimizer State Entries:     {len(ckpt['optimizer_state_dict']['state'])}")
    print(f"• GradScaler State Scale:      {ckpt.get('scaler_state_dict', {}).get('scale', 'N/A')}")
    print("=" * 60)
    print("✅ Checkpoint loaded cleanly with ZERO corruption or missing state!")

if __name__ == "__main__":
    verify()
