import { describe, expect, it } from "vitest";
import { getMemorySnapshot, normalizeMessages, runPythonScript } from "./inference";

describe("local inference helpers", () => {
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

  it("reports non-negative process and system memory values", () => {
    const memory = getMemorySnapshot();
    expect(memory.processRssBytes).toBeGreaterThan(0);
    expect(memory.processHeapUsedBytes).toBeGreaterThan(0);
    expect(memory.systemTotalBytes).toBeGreaterThan(0);
    expect(memory.systemFreeBytes).toBeGreaterThanOrEqual(0);
  });

  it("parses a successful response from a Python child process", async () => {
    await expect(
      runPythonScript("test_child_process.py", { value: "round trip" }, 2_000)
    ).resolves.toEqual({ ok: true, echo: "round trip" });
  });

  it("surfaces a non-zero Python child-process exit as an application error", async () => {
    await expect(
      runPythonScript("test_child_process.py", { mode: "fail" }, 2_000)
    ).rejects.toThrow("intentional fixture failure");
  });
});
