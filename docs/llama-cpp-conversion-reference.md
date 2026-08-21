# llama.cpp Conversion Reference

The official `llama.cpp` converter accepts a local Hugging Face model directory, writes an F16 GGUF intermediate, and supports Llama-family configuration metadata. The official command-line converter source documents `--outtype f16` as a supported output type; a compiled `llama-quantize` binary then produces the final quantized GGUF.

Source: https://github.com/ggml-org/llama.cpp/blob/master/convert_hf_to_gguf.py
