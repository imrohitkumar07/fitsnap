import sys
import os
import json
import time
import torch

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)
except Exception:
    pass

sys.path.insert(0, "ml")
from train_cnn import build_model, CachedFoodDataset, DataLoader, apply_mixup_cutmix

with open("ml/data/train_split.json") as f:
    tr = json.load(f)
with open("ml/data/classes.json") as f:
    cl = json.load(f)
c2i = {c: i for i, c in enumerate(cl)}

print(f"Loaded {len(tr)} train samples, {len(cl)} classes.")

ds = CachedFoodDataset(tr[:128], 128, c2i, is_training=True)
loader = DataLoader(ds, batch_size=64, shuffle=True, num_workers=0)

model = build_model(len(cl), preset="base").cuda()
criterion = torch.nn.CrossEntropyLoss()
scaler = torch.amp.GradScaler("cuda")
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)

print("Testing 2 training steps...")
for step, (x, y) in enumerate(loader):
    t0 = time.time()
    x, y = x.cuda(), y.cuda()
    with torch.amp.autocast("cuda"):
        out = model(x)
        loss = criterion(out, y)
    scaler.scale(loss).backward()
    scaler.step(opt)
    scaler.update()
    opt.zero_grad()
    dur = time.time() - t0
    print(f"Step {step} done in {dur:.3f}s! Loss: {loss.item():.4f}")

print("ALL SUCCESS!")
