import { describe, expect, it } from "vitest";
import { buildChatPrompt, extractAssistantResponse, getMemorySnapshot, normalizeMessages } from "./inference";

describe("llama.cpp inference helpers", () => {
  it("normalizes prompt whitespace while preserving roles", () => {
    expect(
      normalizeMessages([
        { role: "system", content: "  Be concise.  " },
        { role: "user", content: "  Explain RAM.  " },
      ])
    ).toEqual([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Explain RAM." },
    ]);
  });

  it("creates a ChatML prompt with a default system instruction and assistant turn", () => {
    const prompt = buildChatPrompt([{ role: "user", content: "Explain GGUF." }]);
    expect(prompt).toContain("<|im_start|>system");
    expect(prompt).toContain("<|im_start|>user\nExplain GGUF.<|im_end|>");
    expect(prompt.endsWith("<|im_start|>assistant\n")).toBe(true);
  });

  it("extracts only the assistant response from llama.cpp CLI output", () => {
    const prompt = "<|im_start|>user\nHello<|im_end|>\n<|im_start|>assistant\n";
    const output = `Loading model...\n> ${prompt}Hello from the local model.\n[ Prompt: 200.0 t/s | Generation: 100.0 t/s ]\nExiting...\n`;
    expect(extractAssistantResponse(output, prompt)).toBe("Hello from the local model.");
  });

  it("reports non-negative process and system memory values", () => {
    const memory = getMemorySnapshot();
    expect(memory.processRssBytes).toBeGreaterThan(0);
    expect(memory.processHeapUsedBytes).toBeGreaterThan(0);
    expect(memory.systemTotalBytes).toBeGreaterThan(0);
    expect(memory.systemFreeBytes).toBeGreaterThanOrEqual(0);
  });
});
