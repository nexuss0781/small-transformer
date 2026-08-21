# Deployment Research Notes

The requested model’s official Hugging Face repository is `HuggingFaceTB/SmolLM2-135M-Instruct`. Its model card demonstrates CPU loading with `AutoTokenizer.from_pretrained` and `AutoModelForCausalLM.from_pretrained`, then moving the loaded model to the CPU device. The implementation will apply the tokenizer’s chat template before generation so the Instruct model receives structured conversation input.

Render Blueprint definitions live in a root `render.yaml` file. Render web services provide their HTTP port through the `PORT` environment variable, so the application must use that runtime value while the Docker image declares port `3000` for local use. The Docker service will remain self-contained: no model or application secret needs to be configured at runtime.

Sources: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct and https://render.com/docs/blueprint-spec.
