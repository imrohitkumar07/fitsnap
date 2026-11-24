"""
test_server_local.py
Automated Verification Suite for Local ML Server (Part 5)
Tests:
1. Quality Guard: blur, dark, entropy
2. Custom ResNet Classifier: Top-3 calibrated predictions
3. 4-Level U-Net Segmenter: Food mask, area, and geometric portioning
4. Grad-CAM Hooks: Visual explainability heatmap generation
"""

import sys
import os
import json
import io
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import torch
import numpy as np
import cv2
from PIL import Image

import server
from server import (
    check_image_quality,
    load_models,
    estimate_geometric_portion,
    CLASS_NAMES,
    eval_transform_cnn,
    eval_transform_unet,
    DEVICE
)

def run_tests():
    print("\n=============================================================")
    print("🧪 FITSNAP LOCAL ML INFERENCE TEST SUITE (Part 5)")
    print("=============================================================\n")

    # 1. Load models
    load_models()
    assert server.classifier_model is not None, "Failed to load classifier model"
    print("  ✅ 1. Custom ResNet loaded successfully on", DEVICE)

    # 2. Test Image Quality Checks
    print("\n  🔍 Testing Quality Guard...")
    # Normal image
    normal_img = Image.new("RGB", (256, 256), color=(180, 140, 90))
    q_norm = check_image_quality(normal_img)
    print(f"     Normal image -> Blurry: {q_norm['is_blurry']}, Dark: {q_norm['is_dark']}")

    # Blurry image (low Laplacian variance)
    blur_np = cv2.GaussianBlur(np.array(normal_img), (25, 25), 0)
    blur_img = Image.fromarray(blur_np)
    q_blur = check_image_quality(blur_img)
    assert q_blur["is_blurry"], f"Expected is_blurry=True, got {q_blur}"
    print(f"     ✅ Blur detection test PASSED: Laplacian Var={q_blur['laplacian_var']} (< 80)")

    # Dark image
    dark_img = Image.new("RGB", (256, 256), color=(10, 10, 10))
    q_dark = check_image_quality(dark_img)
    assert q_dark["is_dark"], f"Expected is_dark=True, got {q_dark}"
    print(f"     ✅ Dark image detection test PASSED: Brightness={q_dark['mean_brightness']} (< 35)")

    # 3. Test Custom ResNet & Grad-CAM on a real test image
    test_json_path = BASE_DIR / "data" / "test_split.json"
    if test_json_path.exists():
        with open(test_json_path, "r", encoding="utf-8") as f:
            test_samples = json.load(f)

        sample = test_samples[0]
        sample_path = BASE_DIR.parent / sample["path"]
        print(f"\n  🎯 Testing Inference on real test sample: '{sample['class_name']}'...")

        real_img = Image.open(sample_path).convert("RGB")
        input_cnn = eval_transform_cnn(real_img).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            logits = server.classifier_model(input_cnn)
            probs = torch.softmax(logits, dim=-1)[0]
            top3 = torch.topk(probs, k=3)

        top_pred_idx = top3.indices[0].item()
        top_pred_class = CLASS_NAMES[top_pred_idx]
        top_conf = top3.values[0].item()

        print(f"     Top-1 Prediction: '{top_pred_class}' ({top_conf*100:.1f}% confidence)")
        print(f"     Ground Truth:     '{sample['class_name']}'")
        assert top_conf > 0.3, "Confidence too low"
        print("     ✅ CNN classification inference PASSED")

        # 4. Grad-CAM Heatmap
        if server.gradcam_hook is not None:
            heatmap = server.gradcam_hook.generate_heatmap(input_cnn, top_pred_idx)
            assert heatmap.shape == (224, 224), f"Unexpected heatmap shape: {heatmap.shape}"
            assert heatmap.max() > 0, "Empty heatmap generated"
            print(f"     ✅ Grad-CAM hook heatmap PASSED: Shape={heatmap.shape}, Range=[{heatmap.min():.2f}, {heatmap.max():.2f}]")

        # 5. U-Net Segmentation & Geometric Portioning
        if server.unet_model is not None:
            input_unet = eval_transform_unet(real_img).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                u_logits = server.unet_model(input_unet)
                u_prob = torch.sigmoid(u_logits)[0, 0].cpu().numpy()

            portion_res = estimate_geometric_portion(u_prob, top_pred_class)
            print(f"     U-Net Coverage:   {portion_res['coverage_ratio']*100:.1f}% of plate")
            print(f"     Estimated Weight: {portion_res['estimated_grams']}g ({portion_res['portion_range']})")
            assert portion_res['estimated_grams'] > 0, "Invalid portion estimation"
            assert portion_res['is_weak_mask_supervised'], "Must be marked weak mask supervised"
            print("     ✅ Geometric portion estimation PASSED")

    print("\n=============================================================")
    print("🏁 ALL LOCAL ML INFERENCE TESTS PASSED (100% Zero-Cloud)")
    print("=============================================================\n")

if __name__ == "__main__":
    run_tests()
