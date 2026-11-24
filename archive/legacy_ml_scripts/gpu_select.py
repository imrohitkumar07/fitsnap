"""
ml/gpu_select.py - GPU Selection, Pre-Training Safety Checks, and Thermal Monitoring
Strictly selects the dedicated NVIDIA GPU with the most VRAM and enforces hardware safety.
"""

import os
import sys
import subprocess
import time

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

def query_nvidia_devices():
    """Query nvidia-smi for all available NVIDIA GPUs, their index, name, and total VRAM."""
    devices = []
    try:
        cmd = ["nvidia-smi", "--query-gpu=index,name,memory.total", "--format=csv,noheader,nounits"]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        for line in res.stdout.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 3:
                idx = int(parts[0])
                name = parts[1]
                vram_mb = float(parts[2])
                devices.append({
                    "index": idx,
                    "name": name,
                    "vram_mb": vram_mb
                })
    except Exception as e:
        pass
    return devices

def select_best_gpu():
    """
    Identifies the NVIDIA GPU with the most VRAM, sets CUDA_VISIBLE_DEVICES,
    imports torch, asserts CUDA is available, and prints hardware details.
    """
    devices = query_nvidia_devices()
    if not devices:
        print("\n" + "="*70)
        print("❌ FATAL: No NVIDIA GPU detected via nvidia-smi!")
        print("Training cannot continue on CPU. Dedicated NVIDIA GPU is required.")
        print("="*70 + "\n")
        sys.exit(1)

    # Pick device with the maximum VRAM
    best_device = max(devices, key=lambda d: d["vram_mb"])
    chosen_idx = best_device["index"]
    
    # Set CUDA_VISIBLE_DEVICES before importing torch
    if not os.environ.get("CUDA_VISIBLE_DEVICES"):
        os.environ["CUDA_VISIBLE_DEVICES"] = str(chosen_idx)

    import torch
    if not torch.cuda.is_available():
        print("\n" + "="*70)
        print(f"❌ FATAL: PyTorch reports CUDA is NOT available for device {chosen_idx} ({best_device['name']})!")
        print("Please check PyTorch CUDA installation.")
        print("="*70 + "\n")
        sys.exit(1)

    device_name = torch.cuda.get_device_name(0)
    vram_bytes = torch.cuda.get_device_properties(0).total_memory
    vram_mb = vram_bytes / (1024 ** 2)
    major, minor = torch.cuda.get_device_capability(0)

    print("=" * 70)
    print("🚀 [GPU SELECTION] Dedicated Graphics Hardware Activated:")
    print(f"   • Device Name:        {device_name}")
    print(f"   • Physical Index:     {chosen_idx}")
    print(f"   • Dedicated VRAM:     {vram_mb:.1f} MiB ({vram_mb/1024:.2f} GB)")
    print(f"   • Compute Capability: {major}.{minor}")
    print(f"   • PyTorch Version:    {torch.__version__}")
    print(f"   • CUDA Runtime:       {torch.version.cuda}")
    print("=" * 70)

    return {
        "device": torch.device("cuda:0"),
        "name": device_name,
        "vram_mb": vram_mb,
        "capability": f"{major}.{minor}"
    }

def get_gpu_metrics():
    """
    Returns current GPU utilization (%), memory used (MB), total memory (MB), and temperature (C).
    Uses pynvml (nvidia-ml-py) with subprocess fallback.
    """
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle).gpu
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        mem_used_mb = mem_info.used / (1024 ** 2)
        mem_total_mb = mem_info.total / (1024 ** 2)
        temp_c = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        return {
            "util_percent": util,
            "mem_used_mb": mem_used_mb,
            "mem_total_mb": mem_total_mb,
            "temp_c": temp_c
        }
    except Exception:
        # Fallback via nvidia-smi
        try:
            cmd = ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            return {
                "util_percent": float(parts[0]),
                "mem_used_mb": float(parts[1]),
                "mem_total_mb": float(parts[2]),
                "temp_c": float(parts[3])
            }
        except Exception:
            return {
                "util_percent": 0.0,
                "mem_used_mb": 0.0,
                "mem_total_mb": 0.0,
                "temp_c": 0.0
            }

def run_pretraining_safety_checklist():
    """
    Step C: Laptop-specific safety checklist:
    - Battery check (psutil.sensors_battery)
    - Windows power plan check (powercfg /getactivescheme)
    - GPU initial temperature check
    """
    print("\n🔍 Running Pre-Training Laptop Safety Checklist...")
    safety_warnings = []

    # 1. Battery check
    try:
        import psutil
        battery = psutil.sensors_battery()
        if battery is not None:
            if not battery.power_plugged:
                safety_warnings.append(f"⚠️  Laptop is running on BATTERY ({battery.percent}%). Please plug in AC power for GPU training!")
            else:
                print(f"   [PASS] AC Power Connected ({battery.percent}% charged).")
    except Exception as e:
        print(f"   [INFO] Battery status check skipped: {e}")

    # 2. Windows power plan check
    if sys.platform == "win32":
        try:
            res = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True, check=True)
            scheme_out = res.stdout.strip()
            print(f"   [POWER PLAN] {scheme_out}")
            if "High performance" not in scheme_out and "Ultimate Performance" not in scheme_out:
                safety_warnings.append(
                    "⚠️  Active Windows Power Plan is not 'High performance'. "
                    "For maximum GPU throughput on AC power, consider running: powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
                )
        except Exception as e:
            print(f"   [INFO] Power scheme query skipped: {e}")

    # 3. Initial GPU temperature
    metrics = get_gpu_metrics()
    print(f"   [GPU STATUS] Initial Temp: {metrics['temp_c']}°C | VRAM In Use: {metrics['mem_used_mb']:.1f} / {metrics['mem_total_mb']:.1f} MB")
    if metrics["temp_c"] >= 85:
        safety_warnings.append(f"⚠️  GPU initial temperature is elevated ({metrics['temp_c']}°C >= 85°C)! Allow fans to cool down before full load.")

    if safety_warnings:
        print("\n" + "!" * 70)
        print("SAFETY WARNINGS:")
        for w in safety_warnings:
            print(f"  {w}")
        print("!" * 70 + "\n")
    else:
        print("   ✅ All hardware safety checks passed.\n")

class ThermalProtection:
    """Monitors GPU temperature and throttles/pauses if threshold exceeded."""
    def __init__(self, warn_temp=85, critical_temp=88, critical_duration_sec=60, cooldown_sec=120):
        self.warn_temp = warn_temp
        self.critical_temp = critical_temp
        self.critical_duration_sec = critical_duration_sec
        self.cooldown_sec = cooldown_sec
        self.high_temp_start = None

    def check(self, on_save_checkpoint_fn=None):
        metrics = get_gpu_metrics()
        temp = metrics["temp_c"]
        if temp >= self.critical_temp:
            now = time.time()
            if self.high_temp_start is None:
                self.high_temp_start = now
            elif (now - self.high_temp_start) >= self.critical_duration_sec:
                print(f"\n🔥 [THERMAL PROTECTION] GPU temperature has been >= {self.critical_temp}°C for {self.critical_duration_sec}s (Current: {temp}°C)!")
                if on_save_checkpoint_fn:
                    print("   💾 Saving emergency checkpoint before cooldown...")
                    on_save_checkpoint_fn()
                print(f"   ❄️ Pausing training for {self.cooldown_sec} seconds to allow GPU fans to cool down...")
                time.sleep(self.cooldown_sec)
                self.high_temp_start = None
                print("   ▶️ Resuming training.")
        else:
            self.high_temp_start = None

if __name__ == "__main__":
    info = select_best_gpu()
    run_pretraining_safety_checklist()
