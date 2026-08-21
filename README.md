# SmolLM2 Inference Window

This application is a self-contained local chat interface for `HuggingFaceTB/SmolLM2-135M-Instruct`. The Docker image uses CPU-only PyTorch and downloads the model during the image build, so no model download or external configuration is needed when the container starts.

Build the image from this project directory with:

```bash
docker build -t smollm2-inference-window .
```

Run the application on port `3000` with:

```bash
docker run --rm -p 3000:3000 smollm2-inference-window
```

Then open `http://localhost:3000`. The terminal-style interface shows model readiness, the Node process resident memory, measured peak RAM for the most recent Python model process, and detected system-memory use.

The image runs without a GPU, authentication flow, database dependency, model volume, or required runtime environment variables. Model weights are stored at `/opt/models/SmolLM2-135M-Instruct` inside the image and the Python scripts enforce offline loading at inference time.

