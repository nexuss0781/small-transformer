import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const context: TrpcContext = {
  req: { headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
  user: null,
};

const caller = appRouter.createCaller(context);
const result = await caller.model.chat({
  messages: [{ role: "user", content: "Reply with a warm greeting in one sentence." }],
  maxNewTokens: 32,
});

console.log(JSON.stringify(result, null, 2));
