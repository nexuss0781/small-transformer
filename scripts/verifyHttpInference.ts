import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers";

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: "http://127.0.0.1:3000/api/trpc", transformer: superjson })],
});

const result = await client.model.chat.mutate({
  messages: [{ role: "user", content: "Reply with exactly four upbeat words." }],
  maxNewTokens: 24,
});

console.log(JSON.stringify(result, null, 2));
