"""
ml/test_oom_handler_cpu.py
Unit test for Out-Of-Memory (OOM) Adaptive Halving Handler.
STRICTLY RUNS ON CPU ONLY to protect the active GPU training process.
"""

import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

# Force CPU only - do not touch CUDA
os.environ["CUDA_VISIBLE_DEVICES"] = ""

import torch
import torch.nn as nn

class ToyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Conv2d(3, 16, kernel_size=3, padding=1)
        self.fc = nn.Linear(16 * 8 * 8, 10)

    def forward(self, x):
        h = torch.relu(self.conv(x))
        return self.fc(h.view(h.size(0), -1))

class SimulatedOOMModel(nn.Module):
    """Wraps model to raise OutOfMemoryError if batch size > 8, simulating VRAM exhaustion."""
    def __init__(self, base_model, max_safe_batch=8):
        super().__init__()
        self.base_model = base_model
        self.max_safe_batch = max_safe_batch

    def forward(self, x):
        if x.size(0) > self.max_safe_batch:
            raise torch.cuda.OutOfMemoryError(
                f"CUDA out of memory. Tried to allocate 1.50 GiB (GPU 0; 6.00 GiB total capacity; 400.00 MiB free; "
                f"batch size {x.size(0)} exceeds limit {self.max_safe_batch})"
            )
        return self.base_model(x)

def execute_with_oom_recovery(model, inputs, targets, criterion, accum_steps=1):
    """
    Executes forward + backward with automatic OOM interception and micro-batch halving.
    """
    try:
        outputs = model(inputs)
        loss = criterion(outputs, targets) / accum_steps
        loss.backward()
        return outputs, loss.item() * accum_steps, False  # was_halved = False
    except (torch.cuda.OutOfMemoryError, RuntimeError) as e:
        err_msg = str(e).lower()
        if "out of memory" in err_msg or "cuda out of memory" in err_msg:
            print(f"   [!] [OOM Caught] Detected VRAM exhaustion on batch size {inputs.size(0)}!")
            print(f"       -> Automatically halving batch into 2 micro-batches of {inputs.size(0)//2}...")
            
            half = inputs.size(0) // 2
            if half == 0:
                raise RuntimeError("Batch size already 1; cannot halve further!") from e
            
            sub_accum = accum_steps * 2
            
            # Sub-batch 1
            out1 = model(inputs[:half])
            loss1 = criterion(out1, targets[:half]) / sub_accum
            loss1.backward()
            
            # Sub-batch 2
            out2 = model(inputs[half:])
            loss2 = criterion(out2, targets[half:]) / sub_accum
            loss2.backward()
            
            combined_outputs = torch.cat([out1, out2], dim=0)
            combined_loss = (loss1.item() + loss2.item()) * accum_steps
            print(f"       [PASS] Micro-batch halving recovered successfully! Gradients accumulated without crashing.")
            return combined_outputs, combined_loss, True  # was_halved = True
        else:
            raise e

def test_oom_handler():
    print("=" * 70)
    print("RUNNING OOM ADAPTIVE RECOVERY TEST (STRICTLY ON CPU)")
    print("=" * 70)
    
    device = torch.device("cpu")
    print(f"Target Device: {device} (CUDA Disabled: CUDA_VISIBLE_DEVICES='{os.environ.get('CUDA_VISIBLE_DEVICES')}')")
    
    base_model = ToyModel().to(device)
    # Model will simulate OOM if batch size > 8
    wrapped_model = SimulatedOOMModel(base_model, max_safe_batch=8).to(device)
    criterion = nn.CrossEntropyLoss()

    # Case 1: Normal batch that fits within threshold (Batch size 8)
    print("\n[Case 1: Standard Batch (size 8)]")
    x_small = torch.randn(8, 3, 8, 8, device=device)
    y_small = torch.randint(0, 10, (8,), device=device)
    out, loss, halved = execute_with_oom_recovery(wrapped_model, x_small, y_small, criterion)
    print(f"   Result: Output shape {list(out.shape)}, Loss {loss:.4f}, Was Halved: {halved}")
    assert not halved, "Case 1 should not have triggered halving!"

    # Case 2: Oversized batch that triggers simulated OOM (Batch size 16)
    print("\n[Case 2: Oversized Batch triggering OOM (size 16)]")
    x_large = torch.randn(16, 3, 8, 8, device=device)
    y_large = torch.randint(0, 10, (16,), device=device)
    out, loss, halved = execute_with_oom_recovery(wrapped_model, x_large, y_large, criterion)
    print(f"   Result: Output shape {list(out.shape)}, Combined Loss {loss:.4f}, Was Halved: {halved}")
    assert halved, "Case 2 MUST trigger halving and recovery!"
    assert out.size(0) == 16, "Output tensor must contain all 16 predictions!"

    print("\n" + "=" * 70)
    print("ALL OOM HANDLER TESTS PASSED 100% ON CPU! ZERO GPU IMPACT.")
    print("=" * 70)

if __name__ == "__main__":
    test_oom_handler()
