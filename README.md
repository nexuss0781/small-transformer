# SmolLM2 Q6_K Inference Window

This application is a self-contained local chat interface for `HuggingFaceTB/SmolLM2-135M-Instruct`, running through **llama.cpp** with a locally built **Q6_K GGUF** model. The Docker image downloads the official checkpoint, converts it to GGUF, and quantizes it during the image build. The runtime image contains only the Q6_K model and the C++ inference engine; it has no Python or PyTorch runtime dependency.

Build the image from this project directory with:

```bash
docker build -t smollm2-inference-window .
```

Run the application on port `3000` with:

```bash
docker run --rm -p 3000:3000 smollm2-inference-window
```

Open `http://localhost:3000`. The terminal-style interface shows model readiness, the Node process resident memory, measured peak RAM for the latest llama.cpp process, and detected system-memory use.

The application runs without a GPU, authentication flow, database dependency, model volume, or required runtime environment variables. The baked model is stored at `/opt/models/SmolLM2-135M-Instruct-Q6_K.gguf` and llama.cpp runs with CPU-only settings.
