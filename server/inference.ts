import { spawn } from "child_process";
import { existsSync } from "fs";
import os from "os";
import path from "path";

export const MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";
const PROJECT_ROOT = process.cwd();
const MODEL_DIRECTORY = process.env.MODEL_DIR || path.join(PROJECT_ROOT, "models", "SmolLM2-135M-Instruct");
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const MAX_PROCESS_OUTPUT_BYTES = 1_500_000;

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ModelCheckResult = {
  modelId: string;
  modelDirectory: string;
  ready: boolean;
  missing: string[];
};

type InferenceResult = {
  ok: boolean;
  response?: string;
  error?: string;
  peakRamBytes?: number;
  elapsedMs?: number;
};

let initializationState: "initializing" | "ready" | "unavailable" = "initializing";
let initializationError: string | null = null;
let initializationPromise: Promise<void> | null = null;

function scriptPath(name: string) {
  return path.join(PROJECT_ROOT, "scripts", name);
}

function collectOutput(child: ReturnType<typeof spawn>, timeoutMs: number, stdin?: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("Inference exceeded the 120 second CPU safety limit."));
    }, timeoutMs);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };

    child.stdout?.on("data", chunk => {
      stdout += chunk.toString();
      if (stdout.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("Inference emitted too much output."));
      }
    });
    child.stderr?.on("data", chunk => {
      stderr += chunk.toString();
      if (stderr.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("Inference emitted too much diagnostic output."));
      }
    });
    child.on("error", error => finish(new Error(`Could not start Python: ${error.message}`)));
    child.on("close", code => {
      if (code !== 0) {
        finish(new Error(stderr.trim() || `Python exited with status ${code}.`));
        return;
      }
      finish();
    });

    if (stdin) child.stdin?.end(stdin);
    else child.stdin?.end();
  });
}

export async function runPythonScript(name: string, request?: unknown, timeoutMs = 120_000) {
  const child = spawn(PYTHON_BIN, [scriptPath(name)], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const { stdout } = await collectOutput(child, timeoutMs, request ? JSON.stringify(request) : undefined);
  try {
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error("Python returned an invalid response.");
  }
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

export async function initializeModelCheck() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    initializationState = "initializing";
    initializationError = null;
    try {
      const check = (await runPythonScript("model_check.py", undefined, 15_000)) as ModelCheckResult;
      if (!check.ready) {
        initializationState = "unavailable";
        initializationError = `Baked model is incomplete: ${check.missing.join(", ")}.`;
        return;
      }
      initializationState = "ready";
    } catch (error) {
      initializationState = "unavailable";
      initializationError = error instanceof Error ? error.message : "Model readiness check failed.";
    }
  })();

  return initializationPromise;
}

export function getModelStatus() {
  return {
    modelId: MODEL_ID,
    modelDirectory: MODEL_DIRECTORY,
    status: initializationState,
    ready: initializationState === "ready",
    detail:
      initializationState === "ready"
        ? "Baked CPU model snapshot is ready for inference."
        : initializationState === "initializing"
          ? "Verifying baked model snapshot…"
          : initializationError || "Baked model snapshot is unavailable.",
    modelDirectoryExists: existsSync(MODEL_DIRECTORY),
    memory: getMemorySnapshot(),
  };
}

export async function generateModelResponse(messages: ChatMessage[], maxNewTokens = 256) {
  await initializeModelCheck();
  if (initializationState !== "ready") {
    throw new Error(initializationError || "The model is still initializing.");
  }

  const result = (await runPythonScript("infer.py", {
    messages: normalizeMessages(messages),
    maxNewTokens,
  })) as InferenceResult;

  if (!result.ok || !result.response) {
    throw new Error(result.error || "The model did not return a response.");
  }

  return {
    response: result.response,
    metrics: {
      modelProcessPeakRamBytes: result.peakRamBytes ?? 0,
      generationElapsedMs: result.elapsedMs ?? 0,
      appMemory: getMemorySnapshot(),
    },
  };
}
