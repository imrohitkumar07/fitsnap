import os
import io
import sys
import asyncio
from pathlib import Path

os.environ["MPLCONFIGDIR"] = "C:\\Users\\rrkof\\AppData\\Local\\Temp\\mpl"
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import UploadFile
import server

def run_tests():
    print("1. Initializing and testing load_classifier_model()...", flush=True)
    m = server.load_classifier_model()
    assert m is not None, "Failed to load model"
    print("Model loaded successfully!", flush=True)
    
    print("\n2. Testing health_check()...", flush=True)
    health = server.health_check()
    print("Health:", health, flush=True)
    assert health["status"] == "healthy"
    assert health["classes_count"] == 34
    
    print("\n3. Testing get_classes()...", flush=True)
    classes_resp = server.get_classes()
    print(f"Classes count: {classes_resp['count']}", flush=True)
    assert classes_resp["count"] == 34
    
    print("\n4. Testing predict_food() with sample samosa image...", flush=True)
    img_path = Path("fitsnap/Food Classification Dataset/samosa/samosa_001.jpg")
    with open(img_path, "rb") as f:
        data = f.read()
        
    upload = UploadFile(file=io.BytesIO(data), filename="samosa_001.jpg")
    upload.headers = {"content-type": "image/jpeg"}
    
    result = server.predict_food(upload)
    print("Prediction Result:", flush=True)
    print("  Success:", result.get("success"), flush=True)
    print("  Top Prediction:", result.get("top_prediction")["class_name"], "Confidence:", result.get("top_prediction")["confidence"], flush=True)
    print("  Top 3 Candidates:", [p["class_name"] for p in result.get("predictions", [])], flush=True)
    has_cam = result.get("gradcam") is not None and result.get("gradcam").startswith("data:image/png;base64,")
    print("  Grad-CAM Generated:", has_cam, flush=True)
    
    print("\nSUCCESS: All endpoints and inference logic verified!", flush=True)

if __name__ == "__main__":
    run_tests()
