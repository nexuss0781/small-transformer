import { z } from "zod";
import { generateModelResponse, getModelStatus } from "./inference";
import { publicProcedure, router } from "./_core/trpc";

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
});

export const appRouter = router({
  // Compatibility-only procedure group. It always reports an anonymous session and never performs OAuth.
  auth: router({
    me: publicProcedure.query(() => null),
    logout: publicProcedure.mutation(() => ({ success: true })),
  }),
  model: router({
    status: publicProcedure.query(() => getModelStatus()),
    chat: publicProcedure
      .input(
        z.object({
          messages: z.array(chatMessageSchema).min(1).max(16),
          maxNewTokens: z.number().int().min(8).max(512).optional(),
        })
      )
      .mutation(({ input }) => generateModelResponse(input.messages, input.maxNewTokens)),
  }),
});

export type AppRouter = typeof appRouter;
