import sys
import time
import threading
import subprocess
from pathlib import Path
import uvicorn
import urllib.request

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import server

# Start uvicorn in a daemon thread
def start_server():
    uvicorn.run(server.app, host="127.0.0.1", port=8000, log_level="warning")

thread = threading.Thread(target=start_server, daemon=True)
thread.start()

# Wait for server to be ready
print("Waiting for local server to start on 127.0.0.1:8000...")
for _ in range(40):
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as resp:
            if resp.status == 200:
                print("✅ Server is UP and healthy on http://127.0.0.1:8000!")
                break
    except Exception:
        time.sleep(0.5)

# Test with curl.exe
print("\n" + "=" * 65)
print("Testing live /predict endpoint using curl.exe on real food photo...")
print("=" * 65)

test_photo = str((PROJECT_ROOT / "Food_Classification" / "samosa" / "1.jpg").resolve())
curl_cmd = [
    "curl.exe", "-s", "-X", "POST", "http://127.0.0.1:8000/predict",
    "-F", f"file=@{test_photo}"
]
res = subprocess.run(curl_cmd, capture_output=True, text=True)
print("Exit code:", res.returncode)
if res.stdout:
    import json
    data = json.loads(res.stdout)
    # Truncate gradcam for printing
    if data.get("gradcam"):
        data["gradcam"] = data["gradcam"][:60] + "... [VALID BASE64 JPEG HEATMAP]"
    print(json.dumps(data, indent=2))
else:
    print("stderr:", res.stderr)
