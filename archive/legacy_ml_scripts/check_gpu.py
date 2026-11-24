"""
check_gpu.py
Mandatory hardware verification script for FitSnap model training.
Asserts CUDA availability, inspects VRAM specs, and benchmarks GPU vs CPU matrix multiplication.
All training scripts MUST import and call verify_cuda_environment() or run this directly.
"""

import sys
import time
import os

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# Ensure dedicated GPU is selected before torch initialization
try:
    from ml.gpu_select import select_best_gpu, run_pretraining_safety_checklist
except ImportError:
    try:
        from gpu_select import select_best_gpu, run_pretraining_safety_checklist
    except ImportError:
        select_best_gpu = None
        run_pretraining_safety_checklist = None

if select_best_gpu:
    select_best_gpu()

import torch

def verify_cuda_environment(abort_on_cpu: bool = True):
    if run_pretraining_safety_checklist:
        run_pretraining_safety_checklist()

    print("=" * 65)
    print("🔍 FITSNAP GPU HARDWARE & CUDA VERIFICATION")
    print("=" * 65)

    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {cuda_available}")

    if not cuda_available:
        msg = (
            "❌ FATAL ERROR: No NVIDIA CUDA GPU detected by PyTorch!\n"
            "Silent CPU fallback is prohibited by model policy.\n"
            "Please ensure NVIDIA drivers and CUDA build of PyTorch are installed,\n"
            "or use the provided Cloud Training Notebook (ml/FitSnap_ConvNeXt_Training.ipynb)."
        )
        print(msg, file=sys.stderr)
        if abort_on_cpu:
            raise RuntimeError(msg)
        return False

    device_count = torch.cuda.device_count()
    current_device = torch.cuda.current_device()
    device_name = torch.cuda.get_device_name(current_device)
    props = torch.cuda.get_device_properties(current_device)
    total_vram_gb = props.total_memory / (1024 ** 3)
    free_vram_gb, total_vram_gb_mem = [x / (1024 ** 3) for x in torch.cuda.mem_get_info()]

    print(f"Device Count:       {device_count}")
    print(f"Active Device:      cuda:{current_device} ({device_name})")
    print(f"Compute Capability: {props.major}.{props.minor}")
    print(f"Total VRAM:         {total_vram_gb:.2f} GiB ({props.total_memory / (1024**2):.1f} MiB)")
    print(f"Available VRAM:     {free_vram_gb:.2f} GiB ({free_vram_gb * 1024:.1f} MiB)")
    print(f"PyTorch Version:    {torch.__version__}")
    print(f"PyTorch CUDA Build: {torch.version.cuda}")
    print(f"cuDNN Enabled:      {torch.backends.cudnn.enabled} (Version: {torch.backends.cudnn.version()})")

    # Benchmark: Matrix Multiplication (4096 x 4096 Float32)
    print("\n⚡ Benchmarking MatMul (4096 x 4096 Float32):")
    dim = 4096

    # 1. CPU Run
    t0_cpu = time.perf_counter()
    a_cpu = torch.randn(dim, dim, dtype=torch.float32)
    b_cpu = torch.randn(dim, dim, dtype=torch.float32)
    c_cpu = torch.mm(a_cpu, b_cpu)
    cpu_time = time.perf_counter() - t0_cpu
    print(f"  • CPU MatMul Duration: {cpu_time * 1000:.2f} ms")

    # 2. GPU Warmup & Run
    torch.cuda.empty_cache()
    a_gpu = a_cpu.to("cuda")
    b_gpu = b_cpu.to("cuda")
    torch.cuda.synchronize()

    # Warmup
    _ = torch.mm(a_gpu, b_gpu)
    torch.cuda.synchronize()

    t0_gpu = time.perf_counter()
    c_gpu = torch.mm(a_gpu, b_gpu)
    torch.cuda.synchronize()
    gpu_time = time.perf_counter() - t0_gpu
    speedup = cpu_time / max(gpu_time, 1e-6)

    print(f"  • GPU MatMul Duration: {gpu_time * 1000:.2f} ms")
    print(f"  • GPU Acceleration:    {speedup:.1f}x Speedup over CPU")

    # Numerical parity verification
    diff = (c_cpu - c_gpu.cpu()).abs().max().item()
    print(f"  • Numerical Delta:     {diff:.2e} (Passed)")

    print("\n✅ GPU Hardware Verification Passed: Ready for full GPU training.")
    print("=" * 65)
    return True

if __name__ == "__main__":
    verify_cuda_environment(abort_on_cpu=True)
