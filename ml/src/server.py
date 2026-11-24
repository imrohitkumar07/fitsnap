"""
server.py
FitSnap Unified ML Microservice (FastAPI + PyTorch)
Runs strictly local PyTorch models on the NVIDIA GPU:
1. Custom ResNet Food Classifier (Residual blocks, SiLU, Squeeze-and-Excitation, GAP)
2. 4-Level U-Net Food & Plate Segmenter (Trained on weak pseudo-masks)
3. Diagnostic XAI: Grad-CAM heatmap hooks
4. Quality Guard: Laplacian blur, luminance, entropy
5. Geometric Portion Estimation: Plate diameter * area fraction * food density
Zero Cloud AI / Zero External LLM.
"""

import os
import io
import sys
import json
import math
import base64
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any

os.environ["MPLCONFIGDIR"] = os.path.join(tempfile.gettempdir(), "mpl")
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)
except Exception:
    pass

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as T
from PIL import Image
import numpy as np
import math
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"
DATA_DIR = BASE_DIR / "data"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from models.resnet_custom import build_model, CustomResNet
from models.unet import build_unet, UNet

app = FastAPI(
    title="FitSnap Dual-Model Local ML Service",
    description="Local GPU inference for Custom ResNet Food Classifier and U-Net Plate Segmenter",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load Class Metadata
class_map_data: Dict[str, Any] = {}
class_map_file = BASE_DIR / "class_map.json"
if class_map_file.exists():
    with open(class_map_file, "r", encoding="utf-8") as f:
        class_map_data = json.load(f)

classes_json = DATA_DIR / "classes.json"
if classes_json.exists():
    with open(classes_json, "r", encoding="utf-8") as f:
        CLASS_NAMES = json.load(f)
else:
    CLASS_NAMES = sorted(list(class_map_data.keys()))

# Model instances
classifier_model: Optional[CustomResNet] = None
unet_model: Optional[UNet] = None
gradcam_hook: Optional[Any] = None
optimal_temperature: float = 1.0
class_prototypes: Optional[torch.Tensor] = None

# Evaluation Transforms
eval_transform_cnn = T.Compose([
    T.Resize(256, interpolation=T.InterpolationMode.BICUBIC),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

eval_transform_unet = T.Compose([
    T.Resize((256, 256), interpolation=T.InterpolationMode.BILINEAR),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# ─── Grad-CAM Hook Class ─────────────────────────────────────────────────────

class GradCAMHook:
    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self.fwd_handle = target_layer.register_forward_hook(self._save_activations)
        self.bwd_handle = target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, inp, out):
        self.activations = out

    def _save_gradients(self, module, grad_in, grad_out):
        self.gradients = grad_out[0]

    def generate_heatmap(self, input_tensor: torch.Tensor, class_idx: int) -> np.ndarray:
        self.model.eval()
        self.model.zero_grad()
        output = self.model(input_tensor)
        score = output[0, class_idx]
        score.backward(retain_graph=True)

        weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(cam, size=input_tensor.shape[2:], mode='bilinear', align_corners=False)

        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = torch.zeros_like(cam)

        return cam.squeeze().detach().cpu().numpy()

# ─── Model Loading ───────────────────────────────────────────────────────────

def load_models():
    global classifier_model, unet_model, gradcam_hook, optimal_temperature

    num_classes = len(CLASS_NAMES)
    print(f"\n📦 Initializing Local Models on {DEVICE}...")

    # 1. Custom ResNet Classifier
    cnn_ckpt = CHECKPOINTS_DIR / "cnn_best.pt"
    if not cnn_ckpt.exists():
        cnn_ckpt = CHECKPOINTS_DIR / "cnn_last.pt"
    if not cnn_ckpt.exists():
        cnn_ckpt = CHECKPOINTS_DIR / "best_custom_cnn_small.pth"

    preset = "base"
    state_dict = None
    if cnn_ckpt.exists():
        print(f"  • Loading Custom ResNet weights from: {cnn_ckpt}")
        sd = torch.load(cnn_ckpt, map_location=DEVICE, weights_only=False)
        if isinstance(sd, dict) and "model_state_dict" in sd:
            preset = sd.get("preset", "base")
            state_dict = sd["model_state_dict"]
        else:
            state_dict = sd

    classifier_model = build_model(
        num_classes=num_classes,
        preset=preset,
        dropout_rate=0.2,
        use_se=True
    ).to(DEVICE)

    if state_dict is not None:
        classifier_model.load_state_dict(state_dict)
    else:
        print("  ⚠️ Warning: No trained Custom ResNet weights found. Initialized randomly.")

    classifier_model.eval()

    # Load Temperature Scaling Calibration
    temp_json_path = CHECKPOINTS_DIR / "temperature.json"
    optimal_temperature = 1.0
    if temp_json_path.exists():
        with open(temp_json_path, "r", encoding="utf-8") as f:
            temp_data = json.load(f)
            optimal_temperature = float(temp_data.get("optimal_temperature", 1.0))
            print(f"  • Loaded optimal temperature calibration: T = {optimal_temperature:.3f}")

    # Hook last conv stage for Grad-CAM
    if hasattr(classifier_model, "last_conv_stage"):
        gradcam_hook = GradCAMHook(classifier_model, classifier_model.last_conv_stage)
        print("  • Grad-CAM explainability hook attached to last_conv_stage.")

    # 2. 4-Level U-Net Segmenter
    unet_model = build_unet(in_channels=3, out_channels=1, base_channels=32).to(DEVICE)
    unet_ckpt = CHECKPOINTS_DIR / "unet_best.pt"
    if not unet_ckpt.exists():
        unet_ckpt = CHECKPOINTS_DIR / "best_unet.pth"

    if unet_ckpt.exists():
        print(f"  • Loading 4-Level U-Net weights from: {unet_ckpt}")
        sd_u = torch.load(unet_ckpt, map_location=DEVICE, weights_only=False)
        if isinstance(sd_u, dict) and "model" in sd_u:
            unet_model.load_state_dict(sd_u["model"])
        elif isinstance(sd_u, dict) and "model_state_dict" in sd_u:
            unet_model.load_state_dict(sd_u["model_state_dict"])
        else:
            unet_model.load_state_dict(sd_u)
    else:
        print("  ⚠️ Notice: unet_best.pt not yet found.")

    unet_model.eval()

    # 3. Class Prototypes for Penultimate Embedding OOD Detection
    global class_prototypes
    proto_path = BASE_DIR / "class_prototypes.npy"
    if proto_path.exists():
        proto_np = np.load(proto_path)
        class_prototypes = torch.from_numpy(proto_np).to(DEVICE)
        print(f"  • Loaded {class_prototypes.shape[0]} class prototypes (512-dim) for OOD detection.")
    else:
        print("  ⚠️ Notice: class_prototypes.npy not yet found. OOD detection will use confidence & entropy.")

    print("✅ All local ML models successfully loaded and ready for inference.\n")

@app.on_event("startup")
def startup_event():
    load_models()

# ─── Image Quality Checks ────────────────────────────────────────────────────

def check_image_quality(pil_img: Image.Image) -> Dict[str, Any]:
    np_img = np.array(pil_img.convert("RGB"))
    gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)

    # 1. Laplacian Variance for Blur
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    is_blurry = laplacian_var < 80.0

    # 2. Luminance Check
    mean_brightness = float(np.mean(gray))
    is_dark = mean_brightness < 35.0
    is_overexposed = mean_brightness > 230.0

    # 3. Shannon Entropy Check
    hist, _ = np.histogram(gray.ravel(), bins=256, range=[0, 256], density=True)
    hist = hist[hist > 0]
    entropy = float(-np.sum(hist * np.log2(hist)))
    is_low_entropy = entropy < 3.5

    return {
        "is_blurry": is_blurry,
        "is_dark": is_dark,
        "is_overexposed": is_overexposed,
        "is_low_entropy": is_low_entropy,
        "laplacian_var": round(laplacian_var, 1),
        "mean_brightness": round(mean_brightness, 1),
        "entropy": round(entropy, 2),
    }

# ─── Geometric Portion Estimation ───────────────────────────────────────────

def estimate_geometric_portion(
    mask_np: np.ndarray,
    food_class_name: str
) -> Dict[str, Any]:
    """
    Estimates food portion grams based on U-Net segmentation mask coverage.
    Assumes standard dinner plate diameter = 24 cm -> Area = ~452.4 cm^2.
    """
    total_pixels = mask_np.size
    food_pixels = int(np.sum(mask_np > 0.5))
    coverage_ratio = float(food_pixels) / float(max(1, total_pixels))

    # Dish-specific food densities (g/cm^3) & stack depths (cm)
    lower_name = food_class_name.lower()
    if any(k in lower_name for k in ['burger', 'cheeseburger', 'hamburger']):
        density = 0.52
        effective_depth_cm = 4.2  # Real stacked burger height (bun + patty + cheese + veggies + top bun)
        sane_min, sane_max, fallback_g = 80, 450, 165
    elif any(k in lower_name for k in ['sandwich', 'sub', 'roll', 'wrap']):
        density = 0.58
        effective_depth_cm = 2.8
        sane_min, sane_max, fallback_g = 100, 400, 210
    elif any(k in lower_name for k in ['pizza']):
        density = 0.70
        effective_depth_cm = 1.2
        sane_min, sane_max, fallback_g = 80, 300, 120
    elif any(k in lower_name for k in ['dal', 'curry', 'sambar', 'paneer', 'chole', 'rajma']):
        density = 1.05  # Liquid/semi-solid curries
        effective_depth_cm = 1.2
        sane_min, sane_max, fallback_g = 100, 450, 200
    elif any(k in lower_name for k in ['rice', 'biryani', 'pulao', 'khichdi']):
        density = 0.85
        effective_depth_cm = 1.2
        sane_min, sane_max, fallback_g = 120, 500, 200
    elif any(k in lower_name for k in ['roti', 'chapati', 'paratha', 'naan', 'dosa']):
        density = 0.40  # Flatbreads
        effective_depth_cm = 0.3
        sane_min, sane_max, fallback_g = 40, 250, 80
    else:
        density = 0.80
        effective_depth_cm = 1.0
        sane_min, sane_max, fallback_g = 40, 600, 150

    plate_area_cm2 = math.pi * (12.0 ** 2)  # 452.39 cm^2
    food_area_cm2 = coverage_ratio * plate_area_cm2
    estimated_volume_cm3 = food_area_cm2 * effective_depth_cm
    raw_grams = int(round(estimated_volume_cm3 * density))

    # Cap estimate per class to sane range, falling back to default serving if outside
    if raw_grams < sane_min or raw_grams > sane_max:
        estimated_grams = fallback_g
    else:
        estimated_grams = raw_grams

    lower_bound = int(round(estimated_grams * 0.85))
    upper_bound = int(round(estimated_grams * 1.15))

    return {
        "coverage_ratio": round(coverage_ratio, 3),
        "food_area_cm2": round(food_area_cm2, 1),
        "estimated_grams": estimated_grams,
        "portion_range": f"{lower_bound}g - {upper_bound}g",
        "plate_detected": coverage_ratio > 0.08,
        "is_weak_mask_supervised": True
    }

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "device": str(DEVICE),
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "classifier_loaded": classifier_model is not None,
        "unet_loaded": unet_model is not None,
        "classes_count": len(CLASS_NAMES),
        "models": {
            "classifier": "CustomResNet (Residual Blocks + SiLU + Squeeze-and-Excitation)",
            "segmenter": "4-Level U-Net (Trained on weak pseudo-masks)"
        }
    }

@app.get("/classes")
def get_classes():
    return {"classes": CLASS_NAMES, "count": len(CLASS_NAMES)}

@app.post("/predict")
def predict_food(file: UploadFile = File(...)):
    global classifier_model, unet_model, gradcam_hook

    if classifier_model is None:
        load_models()

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image.")

    try:
        if hasattr(file, "file") and hasattr(file.file, "read"):
            contents = file.file.read()
        else:
            contents = file.read()
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

    # 1. Image Quality Checks
    quality = check_image_quality(pil_img)

    # 2. Custom ResNet Classification (with temperature calibration & prototype distance)
    input_cnn = eval_transform_cnn(pil_img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        feat = classifier_model.forward_features(input_cnn)
        raw_emb = classifier_model.gap(feat).flatten(1) # [1, 512]
        norm_emb = F.normalize(raw_emb, p=2, dim=-1)

        logits = classifier_model.classifier(raw_emb)
        scaled_logits = logits / max(0.01, optimal_temperature)
        probs = torch.softmax(scaled_logits, dim=-1)[0]
        top_k = torch.topk(probs, k=min(3, len(CLASS_NAMES)))

        # Normalized Entropy
        log_k = math.log(max(2, len(CLASS_NAMES)))
        entropy = float(-(probs * torch.log(probs + 1e-12)).sum().item() / log_k)

        # Prototype Cosine Distance (penultimate embedding space)
        proto_dist = 0.5
        closest_proto_class = None
        if class_prototypes is not None:
            cos_sims = torch.matmul(norm_emb, class_prototypes.T) # [1, 272]
            max_sim, best_proto_idx = cos_sims.max(dim=1)
            proto_dist = float(1.0 - max_sim.item())
            closest_proto_class = CLASS_NAMES[best_proto_idx.item()] if best_proto_idx.item() < len(CLASS_NAMES) else None

    predictions = []
    for idx, prob in zip(top_k.indices.tolist(), top_k.values.tolist()):
        c_name = CLASS_NAMES[idx]
        info = class_map_data.get(c_name, {})
        predictions.append({
            "class_name": c_name,
            "confidence": round(float(prob), 4),
            "display_name": info.get("display_name", c_name.replace("_", " ").title()),
            "fdc_id": info.get("fdc_id"),
            "category": info.get("category", "Food"),
            "per_100g": info.get("per_100g", {
                "calories_kcal": 180,
                "protein_g": 8,
                "carbs_g": 22,
                "fat_g": 6,
                "fiber_g": 2
            }),
            "default_portion": info.get("default_portion", {"description": "1 serving", "gramWeight": 150}),
            "portions": info.get("portions", [{"description": "1 serving", "gramWeight": 150}])
        })

    top_class_idx = top_k.indices[0].item()
    top_pred = predictions[0] if predictions else None

    # Calibrated Unknown Food Decision Engine (Validation & OOD calibrated)
    top1_conf = float(top_k.values[0].item())
    top2_conf = float(top_k.values[1].item()) if len(top_k.values) > 1 else 0.0

    is_unknown = bool(top1_conf < 0.30 or entropy > 0.50 or proto_dist > 0.60)
    is_not_sure = bool(not is_unknown and (top1_conf < 0.60 or (top1_conf - top2_conf) < 0.15 or proto_dist > 0.50))

    if is_unknown:
        recognition_state = "unknown"
        state_message = "I couldn't recognise this food. Please search or pick below."
    elif is_not_sure:
        recognition_state = "not_sure"
        state_message = "Not sure - please confirm your food."
    else:
        recognition_state = "recognised"
        state_message = "Recognised with high confidence."

    # 3. U-Net Segmentation & Portion Estimation
    seg_info = {
        "coverage_ratio": 0.45,
        "estimated_grams": 180,
        "portion_range": "150g - 210g",
        "plate_detected": True,
        "is_weak_mask_supervised": True
    }

    if unet_model is not None:
        try:
            input_unet = eval_transform_unet(pil_img).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                u_logits = unet_model(input_unet)
                u_prob = torch.sigmoid(u_logits)[0, 0].cpu().numpy()
            seg_info = estimate_geometric_portion(u_prob, top_pred["class_name"] if top_pred else "Food")
        except Exception as e:
            print(f"U-Net inference error: {e}")

    # 4. Diagnostic Grad-CAM Heatmap
    gradcam_b64 = None
    if gradcam_hook is not None and top_pred:
        try:
            cam_heatmap = gradcam_hook.generate_heatmap(input_cnn, top_class_idx)
            # Create overlay
            w, h = pil_img.size
            cam_resized = cv2.resize(cam_heatmap, (w, h))
            cam_color = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
            cam_color = cv2.cvtColor(cam_color, cv2.COLOR_BGR2RGB)
            orig_np = np.array(pil_img)
            blended = np.uint8(0.45 * cam_color + 0.55 * orig_np)

            buf = io.BytesIO()
            Image.fromarray(blended).save(buf, format="JPEG", quality=85)
            gradcam_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
        except Exception as e:
            print(f"Grad-CAM generation error: {e}")

    # 5. Non-Food and Quality Warning Guard
    is_likely_food = bool(
        not quality.get("is_low_entropy", False)
        and not quality.get("is_dark", False)
        and (seg_info.get("plate_detected", False) or (top_pred and top_pred.get("confidence", 0) > 0.45))
        and not is_unknown
    )
    non_food_warning = None
    if not is_likely_food:
        non_food_warning = "Non-food item or unrecognised plate detected. Model confidence is unverified."

    return {
        "success": True,
        "recognition_state": recognition_state,
        "state_message": state_message,
        "calibrated_confidence": round(top1_conf, 4),
        "entropy": round(entropy, 4),
        "prototype_distance": round(proto_dist, 4),
        "closest_prototype_class": closest_proto_class,
        "embedding": norm_emb[0].cpu().tolist(),
        "is_likely_food": is_likely_food,
        "non_food_warning": non_food_warning,
        "quality_checks": quality,
        "top_prediction": top_pred,
        "predictions": predictions,
        "segmentation": seg_info,
        "device": str(DEVICE),
        "models": {
            "classifier": "CustomResNet (Residual Blocks + SiLU + Squeeze-and-Excitation)",
            "segmenter": "4-Level U-Net (Trained on weak pseudo-masks)"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
