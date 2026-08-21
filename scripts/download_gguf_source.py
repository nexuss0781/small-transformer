"""Download the official SmolLM2 checkpoint used only during Docker image builds."""

import os
from huggingface_hub import snapshot_download


MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct"
MODEL_DIR = os.environ.get("HF_MODEL_DIR", "/opt/hf-model")


snapshot_download(
    repo_id=MODEL_ID,
    local_dir=MODEL_DIR,
    local_dir_use_symlinks=False,
)
print(f"Downloaded {MODEL_ID} to {MODEL_DIR}")
