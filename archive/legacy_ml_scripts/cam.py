import io
import base64
import numpy as np
import torch
import torchvision.transforms as T
from PIL import Image

try:
    from pytorch_grad_cam import GradCAM
    from pytorch_grad_cam.utils.image import show_cam_on_image
    from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
    GRAD_CAM_AVAILABLE = True
except ImportError:
    GRAD_CAM_AVAILABLE = False


def get_target_layer(model):
    """
    Finds the target convolutional layer for ConvNeXt V2 or similar architectures.
    ConvNeXt models in timm have stages: model.stages[-1].blocks[-1]
    """
    if hasattr(model, 'stages') and len(model.stages) > 0:
        last_stage = model.stages[-1]
        if hasattr(last_stage, 'blocks') and len(last_stage.blocks) > 0:
            return [last_stage.blocks[-1]]
        return [last_stage]
    # Fallback search for last Conv2d or norm layer
    conv_layers = [m for m in model.modules() if isinstance(m, torch.nn.Conv2d)]
    if conv_layers:
        return [conv_layers[-1]]
    return None


def generate_gradcam_overlay(model, input_tensor, original_pil_img, target_class_idx=None):
    """
    Generates a Grad-CAM heatmap overlay on top of original_pil_img.
    Returns: base64 encoded PNG data URI string.
    """
    if not GRAD_CAM_AVAILABLE:
        # Graceful fallback: return empty string or original image
        return None

    target_layers = get_target_layer(model)
    if not target_layers:
        return None

    # Ensure model is in eval mode
    model.eval()

    # Targets
    targets = [ClassifierOutputTarget(target_class_idx)] if target_class_idx is not None else None

    # Prepare input image as float32 in range [0, 1] resized to 224x224
    img_rgb = original_pil_img.convert("RGB").resize((224, 224))
    rgb_img_float = np.float32(img_rgb) / 255.0

    try:
        with GradCAM(model=model, target_layers=target_layers) as cam:
            grayscale_cam = cam(input_tensor=input_tensor, targets=targets)
            grayscale_cam = grayscale_cam[0, :]

            # Overlay heatmap on image
            visualization = show_cam_on_image(rgb_img_float, grayscale_cam, use_rgb=True, image_weight=0.55)

            # Convert to PIL and then to Base64 PNG
            vis_pil = Image.fromarray(visualization)
            buffer = io.BytesIO()
            vis_pil.save(buffer, format="PNG")
            b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return f"data:image/png;base64,{b64_str}"
    except Exception as e:
        print(f"Error generating Grad-CAM: {e}")
        return None
