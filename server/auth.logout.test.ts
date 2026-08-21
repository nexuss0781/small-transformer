import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: null,
  };
}

describe("public model router", () => {
  it("exposes a status procedure without requiring a user session", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const status = await caller.model.status();

    expect(status.modelId).toBe("HuggingFaceTB/SmolLM2-135M-Instruct");
    expect(["initializing", "ready", "unavailable"]).toContain(status.status);
  });

  it("rejects an oversized conversation before attempting model inference", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const messages = Array.from({ length: 17 }, (_, index) => ({
      role: "user" as const,
      content: `Prompt ${index}`,
    }));

    await expect(caller.model.chat({ messages })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
