"""
predict_cli.py
Command-line interface for local ML inference (zero-network IPC).
Reads an image path or stdin, executes local Custom ResNet + U-Net inference,
and writes the JSON result to stdout.
"""

import sys
import os
import json
import io
from pathlib import Path

# UTF-8 stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import server
from fastapi import UploadFile

server.load_models()

def run_cli():
    if len(sys.argv) > 1:
        img_path = Path(sys.argv[1])
        with open(img_path, "rb") as f:
            file_bytes = f.read()
        filename = img_path.name
    else:
        file_bytes = sys.stdin.buffer.read()
        filename = "meal.jpg"

    upload = UploadFile(filename=filename, file=io.BytesIO(file_bytes))
    result = server.predict_food(upload)
    print(json.dumps(result))

if __name__ == "__main__":
    run_cli()
