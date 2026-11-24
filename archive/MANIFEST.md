# FitSnap Project Archive Manifest

This archive preserves historical development artifacts, previous version scripts, and redundant snapshots that were consolidated into `main.py` and `app.py`.

## Contents

### 1. `archive/backups/`
- Contains the most recent full SQLite snapshot (`fitsnap_backup_*.db`) prior to cleanup.
- Earlier redundant backups from Nov 1-2, 2026 were pruned to save disk space while preserving database integrity in `fitsnap/server/prisma/dev.db`.

### 2. `archive/legacy_ml_scripts/`
- Historical standalone Python scripts used during Phases 1-5 before consolidation into `main.py`.
- Includes early diagnostic probes, batch test scripts, and experimental loaders.
- Modern production pipeline is unified inside `main.py` and `app.py`.

## Traceability
Every metric and architecture from these archived experiments is cataloged in `ml/results/results.md` and benchmarked in `models/metrics_cnn.json` and `models/metrics_unet.json`.
