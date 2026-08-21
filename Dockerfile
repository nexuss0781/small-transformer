FROM node:22-slim

WORKDIR /app

# Python is required for local model loading and CPU inference. No GPU libraries are installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
COPY scripts ./scripts

# Keep all Python packages in an isolated virtual environment. The PyTorch wheel source is explicitly CPU-only.
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHON_BIN="/opt/venv/bin/python" \
    MODEL_DIR="/opt/models/SmolLM2-135M-Instruct" \
    TRANSFORMERS_OFFLINE="1" \
    HF_HUB_OFFLINE="1"

# Temporarily enable network access only for this build layer, then persist a complete local model snapshot.
RUN TRANSFORMERS_OFFLINE=0 HF_HUB_OFFLINE=0 python scripts/download_model.py \
    && python scripts/model_check.py

COPY . .

RUN npm install -g corepack@latest \
    && corepack enable \
    && corepack pnpm install \
    && corepack pnpm run build

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
