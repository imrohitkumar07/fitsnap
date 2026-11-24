"""
Rebuild Tensor Caches and Masks.
Regenerates .npy cache files from raw datasets if training from scratch is required.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    print("Regenerating dataset splits and caches using main.py prepare...")
    cmd = [sys.executable, str(ROOT / "main.py"), "prepare"]
    sys.exit(subprocess.call(cmd))
