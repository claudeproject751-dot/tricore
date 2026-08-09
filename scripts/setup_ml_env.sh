#!/usr/bin/env bash
# Creates ml/.venv and installs the training stack (CPU-only torch wheels).
set -euo pipefail
cd "$(dirname "$0")/.."

python -m venv ml/.venv
PY="ml/.venv/Scripts/python.exe"
[ -x "$PY" ] || PY="ml/.venv/bin/python"

"$PY" -m pip install --upgrade pip wheel --quiet
# CPU-only torch keeps the wheel ~200MB instead of ~2.5GB of CUDA payload.
"$PY" -m pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
"$PY" -m pip install -r ml/requirements.txt
"$PY" -c "import torch, transformers, datasets, sklearn; print('ml env ok:', torch.__version__, transformers.__version__)"
