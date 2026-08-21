# Project TODO

- [x] Remove the unused authentication and database dependencies from the user-facing inference workflow.
- [x] Add a Python bootstrap script that verifies the baked SmolLM2 135M Instruct snapshot is available locally.
- [x] Add a CPU-only Python inference script using `HuggingFaceTB/SmolLM2-135M-Instruct` and its chat template.
- [x] Add safe Node child-process helpers for invoking Python inference and reading process memory.
- [x] Add public tRPC procedures for model status, process memory, and complete chat responses.
- [x] Build a responsive dark terminal-style chat interface with message history, Markdown responses, send controls, and typing feedback.
- [x] Display model readiness, model identity, CPU mode, and live RAM usage in the interface.
- [x] Add Vitest coverage for input validation and inference process integration helpers.
- [x] Write a Dockerfile that installs Python, CPU-only PyTorch, Transformers, builds the Node app, downloads model weights during image build, and exposes port 3000.
- [x] Render Blueprint work was deliberately omitted at the user’s instruction; no deployment manifest was created.
- [x] Run TypeScript, unit, production-build, and Dockerfile configuration checks (a full Docker build remains for the user’s Docker-capable machine because this sandbox has no Docker CLI).
- [x] Save the completed project checkpoint; external deployment steps are excluded from scope.
- [x] Keep the build focused on the application and omit Render Blueprint or deployment-manifest work.
- [x] Remove user-facing authentication and runtime configuration requirements from the completed application.
- [x] Ensure the Docker image installs CPU dependencies, downloads model weights during build, and runs all model loading and inference internally.
- [x] Add Vitest coverage for successful Python output parsing and child-process error propagation.
