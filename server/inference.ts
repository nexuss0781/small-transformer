import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";

export const MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";
export const QUANTIZATION = "Q6_K";

const PROJECT_ROOT = process.cwd();
const PROJECT_GGUF_MODEL_PATH = path.join(PROJECT_ROOT, "models", "SmolLM2-135M-Instruct-Q6_K.gguf");
const LOCAL_DEVELOPMENT_GGUF_MODEL_PATH = "/home/ubuntu/smollm2-gguf/SmolLM2-135M-Instruct-Q6_K.gguf";
const MODEL_PATH = process.env.LLAMA_MODEL_PATH || (existsSync(PROJECT_GGUF_MODEL_PATH) ? PROJECT_GGUF_MODEL_PATH : LOCAL_DEVELOPMENT_GGUF_MODEL_PATH);
const LOCAL_DEVELOPMENT_LLAMA_CLI = "/home/ubuntu/llama.cpp/build/bin/llama-cli";
const LLAMA_CLI_PATH = process.env.LLAMA_CLI_PATH || (existsSync("/opt/llama/bin/llama-cli") ? "/opt/llama/bin/llama-cli" : LOCAL_DEVELOPMENT_LLAMA_CLI);
const MAX_PROCESS_OUTPUT_BYTES = 1_500_000;
const DEFAULT_SYSTEM_PROMPT = "You are SmolLM2, a concise and helpful local assistant. Use Markdown when it improves clarity and do not claim to use online resources.";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type LlamaProcessResult = {
  stdout: string;
  stderr: string;
  peakRamBytes: number;
};

let initializationState: "initializing" | "ready" | "unavailable" = "initializing";
let initializationError: string | null = null;
let initializationPromise: Promise<void> | null = null;

function getChildRssBytes(pid?: number) {
  if (!pid) return 0;
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const match = status.match(/^VmHWM:\s+(\d+)\s+kB$/m) || status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) * 1024 : 0;
  } catch {
    return 0;
  }
}

function collectOutput(child: ReturnType<typeof spawn>, timeoutMs: number) {
  return new Promise<LlamaProcessResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let peakRamBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("llama.cpp inference exceeded the 120 second CPU safety limit."));
    }, timeoutMs);
    const memoryPoll = setInterval(() => {
      peakRamBytes = Math.max(peakRamBytes, getChildRssBytes(child.pid));
    }, 10);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(memoryPoll);
      peakRamBytes = Math.max(peakRamBytes, getChildRssBytes(child.pid));
      if (error) reject(error);
      else resolve({ stdout, stderr, peakRamBytes });
    };

    child.stdout?.on("data", chunk => {
      stdout += chunk.toString();
      if (stdout.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("llama.cpp emitted too much output."));
      }
    });
    child.stderr?.on("data", chunk => {
      stderr += chunk.toString();
      if (stderr.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("llama.cpp emitted too much diagnostic output."));
      }
    });
    child.on("error", error => finish(new Error(`Could not start llama.cpp: ${error.message}`)));
    child.on("close", code => {
      if (code !== 0) {
        finish(new Error(stderr.trim() || `llama.cpp exited with status ${code}.`));
        return;
      }
      finish();
    });
  });
}

export async function runLlamaCli(args: string[], timeoutMs = 120_000) {
  const child = spawn(LLAMA_CLI_PATH, args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, LLAMA_ARG_N_GPU_LAYERS: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return collectOutput(child, timeoutMs);
}

export function getMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    processRssBytes: memory.rss,
    processHeapUsedBytes: memory.heapUsed,
    systemTotalBytes: os.totalmem(),
    systemFreeBytes: os.freemem(),
  };
}

export function normalizeMessages(messages: ChatMessage[]) {
  return messages.map(message => ({
    role: message.role,
    content: message.content.trim(),
  }));
}

export function buildChatPrompt(messages: ChatMessage[]) {
  const normalized = normalizeMessages(messages);
  const hasSystemMessage = normalized.some(message => message.role === "system");
  const withSystem = hasSystemMessage ? normalized : [{ role: "system" as const, content: DEFAULT_SYSTEM_PROMPT }, ...normalized];
  return `${withSystem.map(message => `<|im_start|>${message.role}\n${message.content}<|im_end|>`).join("\n")}\n<|im_start|>assistant\n`;
}

export function extractAssistantResponse(stdout: string, prompt: string) {
  const normalized = stdout.replace(/\r\n/g, "\n");
  const promptIndex = normalized.lastIndexOf(prompt);
  const candidate = promptIndex >= 0 ? normalized.slice(promptIndex + prompt.length) : normalized;
  return candidate
    .replace(/\n?\[ Prompt:.*\][\s\S]*$/m, "")
    .replace(/\n?Exiting\.\.\.\s*$/m, "")
    .trim();
}

export async function initializeModelCheck() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    initializationState = "initializing";
    initializationError = null;
    if (!existsSync(LLAMA_CLI_PATH)) {
      initializationState = "unavailable";
      initializationError = "llama.cpp executable is unavailable.";
      return;
    }
    if (!existsSync(MODEL_PATH)) {
      initializationState = "unavailable";
      initializationError = "Q6_K GGUF model file is unavailable.";
      return;
    }
    initializationState = "ready";
  })();

  return initializationPromise;
}

export function getModelStatus() {
  return {
    modelId: MODEL_ID,
    modelDirectory: MODEL_PATH,
    quantization: QUANTIZATION,
    engine: "llama.cpp",
    status: initializationState,
    ready: initializationState === "ready",
    detail:
      initializationState === "ready"
        ? "Q6_K GGUF model is ready through llama.cpp."
        : initializationState === "initializing"
          ? "Verifying the local Q6_K GGUF runtime…"
          : initializationError || "Q6_K GGUF runtime is unavailable.",
    modelDirectoryExists: existsSync(MODEL_PATH),
    memory: getMemorySnapshot(),
  };
}

export async function generateModelResponse(messages: ChatMessage[], maxNewTokens = 256) {
  await initializeModelCheck();
  if (initializationState !== "ready") {
    throw new Error(initializationError || "The Q6_K model is still initializing.");
  }

  const prompt = buildChatPrompt(messages);
  const startedAt = Date.now();
  const result = await runLlamaCli([
    "--model", MODEL_PATH,
    "--no-conversation",
    "--single-turn",
    "--no-display-prompt",
    "--simple-io",
    "--no-warmup",
    "--prompt",
    prompt,
    "--n-predict",
    String(Math.min(Math.max(maxNewTokens, 8), 512)),
    "--ctx-size",
    "2048",
    "--temp",
    "0.7",
    "--top-p",
    "0.9",
    "--repeat-penalty",
    "1.1",
    "--seed",
    "42",
  ]);
  const response = extractAssistantResponse(result.stdout, prompt);
  if (!response) {
    throw new Error("llama.cpp completed without an assistant response.");
  }

  return {
    response,
    metrics: {
      modelProcessPeakRamBytes: result.peakRamBytes,
      generationElapsedMs: Date.now() - startedAt,
      appMemory: getMemorySnapshot(),
    },
  };
}
