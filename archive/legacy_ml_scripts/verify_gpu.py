import torch
import sys

def verify_gpu():
    print(f"Python version: {sys.version}")
    print(f"PyTorch version: {torch.__version__}")
    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {cuda_available}")
    
    if not cuda_available:
        print("ERROR: CUDA is not available. Please check driver and PyTorch build.")
        sys.exit(1)
        
    device_count = torch.cuda.device_count()
    device_name = torch.cuda.get_device_name(0)
    device_capability = torch.cuda.get_device_capability(0)
    total_memory = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
    
    print(f"Device Count: {device_count}")
    print(f"Device Name: {device_name}")
    print(f"Compute Capability: {device_capability}")
    print(f"Total VRAM: {total_memory:.1f} MiB")
    
    # Run test tensor operation on GPU
    x = torch.randn(2048, 2048, device="cuda", dtype=torch.float32)
    y = torch.matmul(x, x)
    torch.cuda.synchronize()
    
    print(f"Test Tensor Matmul Shape: {y.shape}")
    print(f"Test Tensor Mean Value: {y.mean().item():.4f}")
    print("SUCCESS: GPU verification passed!")

if __name__ == "__main__":
    verify_gpu()
