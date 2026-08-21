"""Run a single, CPU-only SmolLM2 135M Instruct generation from a JSON stdin request."""

from __future__ import annotations

import json
import os
import resource
import sys
import time
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct"
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "models/SmolLM2-135M-Instruct"))


def peak_ram_bytes() -> int:
    # Linux reports ru_maxrss in KiB. This is the environment used by the Docker image.
    return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) * 1024


def fail(message: str) -> None:
    print(json.dumps({"ok": False, "error": message, "peakRamBytes": peak_ram_bytes()}), flush=True)
    raise SystemExit(1)


def read_request() -> dict[str, Any]:
    try:
        request = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        fail(f"Invalid inference request: {error.msg}")

    messages = request.get("messages")
    if not isinstance(messages, list) or not messages:
        fail("At least one conversation message is required.")
    return request


def main() -> None:
    request = read_request()
    if not MODEL_DIR.is_dir():
        fail(f"Baked model snapshot is unavailable at {MODEL_DIR}.")

    started_at = time.perf_counter()
    torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))

    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained(MODEL_DIR, local_files_only=True)
    model.to("cpu")
    model.eval()

    messages = request["messages"]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    max_new_tokens = int(request.get("maxNewTokens", 256))

    with torch.inference_mode():
        generated = model.generate(
            **inputs,
            max_new_tokens=max(8, min(max_new_tokens, 512)),
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id,
        )

    output_tokens = generated[0][inputs["input_ids"].shape[1] :]
    response = tokenizer.decode(output_tokens, skip_special_tokens=True).strip()
    print(
        json.dumps(
            {
                "ok": True,
                "response": response or "I could not generate a response for that prompt.",
                "peakRamBytes": peak_ram_bytes(),
                "elapsedMs": round((time.perf_counter() - started_at) * 1000),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # Keeps child-process responses machine-readable.
        fail(str(error))
