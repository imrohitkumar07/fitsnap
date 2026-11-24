import json
from pathlib import Path

notebook = {
    "cells": [
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "# FitSnap - ConvNeXt V2-Tiny Food Classification & Grad-CAM Training\n",
                "\n",
                "This notebook trains a production food image classifier using **ConvNeXt V2-Tiny** (`convnextv2_tiny.fcmae_ft_in22k_in1k`) from `timm` for the FitSnap nutrition tracking application, complete with Grad-CAM explainability and calibrated confidence."
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# Step 0: Check GPU\n",
                "!nvidia-smi\n",
                "import torch\n",
                "print('PyTorch Version:', torch.__version__)\n",
                "print('CUDA Available:', torch.cuda.is_available())\n",
                "if torch.cuda.is_available():\n",
                "    print('Device Name:', torch.cuda.get_device_name(0))\n",
                "    print('VRAM:', f'{torch.cuda.get_device_properties(0).total_memory / (1024**2):.1f} MB')"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# Install requirements\n",
                "!pip install -q timm torchvision scikit-learn matplotlib pandas grad-cam tqdm"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "import os\n",
                "import random\n",
                "import numpy as np\n",
                "import torch\n",
                "import torch.nn as nn\n",
                "from torch.utils.data import DataLoader, Subset, Dataset\n",
                "import torchvision.transforms as T\n",
                "from PIL import Image\n",
                "import timm\n",
                "\n",
                "SEED = 42\n",
                "random.seed(SEED)\n",
                "np.random.seed(SEED)\n",
                "torch.manual_seed(SEED)\n",
                "if torch.cuda.is_available():\n",
                "    torch.cuda.manual_seed_all(SEED)"
            ]
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "### Define Model: ConvNeXt V2-Tiny\n",
                "Using pretrained `convnextv2_tiny.fcmae_ft_in22k_in1k` weights with custom 34-class classification head."
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "NUM_CLASSES = 34\n",
                "device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')\n",
                "model = timm.create_model('convnextv2_tiny.fcmae_ft_in22k_in1k', pretrained=True, num_classes=NUM_CLASSES)\n",
                "model = model.to(device, memory_format=torch.channels_last)\n",
                "print('Model successfully loaded onto', device)"
            ]
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "### Grad-CAM Explainability Visualization"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "from pytorch_grad_cam import GradCAM\n",
                "from pytorch_grad_cam.utils.image import show_cam_on_image\n",
                "from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget\n",
                "\n",
                "target_layers = [model.stages[-1].blocks[-1]]\n",
                "print('Grad-CAM Target Layer:', target_layers)"
            ]
        }
    ],
    "metadata": {
        "accelerator": "GPU",
        "colab": {"provenance": []},
        "kernelspec": {
            "display_name": "Python 3",
            "name": "python3"
        },
        "language_info": {
            "name": "python"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 0
}

output_path = Path(__file__).resolve().parent / "FitSnap_ConvNeXt_Training.ipynb"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=2)
print(f"Notebook written to: {output_path}")
