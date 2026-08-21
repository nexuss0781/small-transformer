"""Verify that a locally baked model snapshot is present without downloading anything."""

from pathlib import Path
import json
import os
import sys

MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct"
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "models/SmolLM2-135M-Instruct"))
REQUIRED_FILES = ("config.json", "tokenizer_config.json")


def main() -> None:
    missing = [name for name in REQUIRED_FILES if not (MODEL_DIR / name).is_file()]
    model_files = list(MODEL_DIR.glob("*.safetensors")) or list(MODEL_DIR.glob("pytorch_model*.bin"))
    if not model_files:
        missing.append("model weights")

    payload = {
        "modelId": MODEL_ID,
        "modelDirectory": str(MODEL_DIR),
        "ready": not missing,
        "missing": missing,
    }
    print(json.dumps(payload), flush=True)
    sys.exit(0 if payload["ready"] else 2)


if __name__ == "__main__":
    main()
