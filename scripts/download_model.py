"""Download the requested SmolLM2 model at container image build time."""

from pathlib import Path
import os

from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct"
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "/opt/models/SmolLM2-135M-Instruct"))


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {MODEL_ID} into {MODEL_DIR}", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID)
    tokenizer.save_pretrained(MODEL_DIR)
    model.save_pretrained(MODEL_DIR, safe_serialization=True)
    print("Model snapshot complete", flush=True)


if __name__ == "__main__":
    main()
