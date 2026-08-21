FROM node:22-slim AS llama-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /opt/llama.cpp \
    && cmake -S /opt/llama.cpp -B /opt/llama.cpp/build -DGGML_NATIVE=ON -DGGML_CURL=OFF -DLLAMA_BUILD_SERVER=ON \
    && cmake --build /opt/llama.cpp/build --config Release --target llama-cli llama-quantize -j 2

FROM node:22-slim AS model-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=llama-builder /opt/llama.cpp /opt/llama.cpp
COPY scripts/download_gguf_source.py /opt/scripts/download_gguf_source.py

RUN pip3 install --no-cache-dir --break-system-packages torch --index-url https://download.pytorch.org/whl/cpu \
    && pip3 install --no-cache-dir --break-system-packages huggingface-hub==0.27.1 safetensors==0.5.2 sentencepiece==0.2.2

ENV HF_MODEL_DIR=/opt/hf-model

RUN python3 /opt/scripts/download_gguf_source.py \
    && mkdir -p /opt/models \
    && python3 /opt/llama.cpp/convert_hf_to_gguf.py /opt/hf-model --outtype f16 --outfile /opt/models/SmolLM2-135M-Instruct-f16.gguf \
    && /opt/llama.cpp/build/bin/llama-quantize /opt/models/SmolLM2-135M-Instruct-f16.gguf /opt/models/SmolLM2-135M-Instruct-Q6_K.gguf Q6_K \
    && rm -f /opt/models/SmolLM2-135M-Instruct-f16.gguf

FROM node:22-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=llama-builder /opt/llama.cpp/build/bin/llama-cli /opt/llama/bin/llama-cli
COPY --from=llama-builder /opt/llama.cpp/build/bin/libllama-cli-impl.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libllama-server-impl.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libllama-common.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libllama.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libggml-base.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libggml.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libggml-cpu.so* /opt/llama/bin/
COPY --from=llama-builder /opt/llama.cpp/build/bin/libmtmd.so* /opt/llama/bin/
COPY --from=model-builder /opt/models/SmolLM2-135M-Instruct-Q6_K.gguf /opt/models/SmolLM2-135M-Instruct-Q6_K.gguf

ENV LLAMA_CLI_PATH=/opt/llama/bin/llama-cli \
    LLAMA_MODEL_PATH=/opt/models/SmolLM2-135M-Instruct-Q6_K.gguf \
    LD_LIBRARY_PATH=/opt/llama/bin \
    NODE_ENV=production \
    PORT=3000

COPY package.json pnpm-lock.yaml ./
RUN npm install -g corepack@latest \
    && corepack enable \
    && corepack pnpm install --frozen-lockfile

COPY . .
RUN corepack pnpm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
