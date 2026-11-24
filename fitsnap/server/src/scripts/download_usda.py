"""
fitsnap/server/src/scripts/download_usda.py
Downloads and extracts public USDA SR Legacy (~8.4 MB) CSV dataset.
"""

import os
import sys
import zipfile
import urllib.request

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

DEST_DIR = os.path.abspath("fitsnap/data/usda_downloads")
os.makedirs(DEST_DIR, exist_ok=True)

sr_url = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
zip_path = os.path.join(DEST_DIR, "sr_legacy.zip")
extract_dir = os.path.join(DEST_DIR, "sr_legacy")

print(f"⬇️ Downloading SR Legacy from {sr_url}...", flush=True)
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
req = urllib.request.Request(sr_url, headers=headers)
with urllib.request.urlopen(req, timeout=120) as resp, open(zip_path, 'wb') as out_f:
    total_bytes = 0
    while True:
        chunk = resp.read(128 * 1024)
        if not chunk:
            break
        out_f.write(chunk)
        total_bytes += len(chunk)
        if total_bytes % (1024 * 1024) < (128 * 1024):
            print(f"   Downloaded {total_bytes / (1024*1024):.1f} MB...", flush=True)

print(f"✅ Total Downloaded: {total_bytes / (1024*1024):.2f} MB", flush=True)
print(f"📂 Extracting sr_legacy.zip...", flush=True)
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_dir)
print(f"✅ Successfully extracted to {extract_dir}", flush=True)
