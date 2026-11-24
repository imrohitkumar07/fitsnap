import torch
import torchvision
import timm
import sklearn
import matplotlib
import pandas
import pytorch_grad_cam
import tqdm
import fastapi
import uvicorn

print("All imports succeeded!")
print("PyTorch:", torch.__version__)
print("Torchvision:", torchvision.__version__)
print("timm:", timm.__version__)
print("Grad-CAM:", pytorch_grad_cam.__name__)

# Test model initialization on GPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

model = timm.create_model("convnextv2_tiny", pretrained=False, num_classes=34)
model.to(device, memory_format=torch.channels_last)

from pytorch_grad_cam import GradCAM
target_layer = [model.stages[-1].blocks[-1]]
cam = GradCAM(model=model, target_layers=target_layer)

x = torch.randn(2, 3, 224, 224, device=device).to(memory_format=torch.channels_last)
out = model(x)
print("Forward pass successful! Output tensor shape:", out.shape)
print("GPU & ConvNeXt V2 & Grad-CAM pipeline verified!")
