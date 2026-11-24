"""
Run End-to-End Smoke Test on FitSnap Backend.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    cmd = [sys.executable, str(ROOT / "app.py"), "--smoke-test"]
    sys.exit(subprocess.call(cmd))
