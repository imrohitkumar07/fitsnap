"""
FitSnap App Launcher Helper.
Launches the FastAPI backend serving both API and frontend.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    cmd = [sys.executable, str(ROOT / "app.py")] + sys.argv[1:]
    sys.exit(subprocess.call(cmd))
