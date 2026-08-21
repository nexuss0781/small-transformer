import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Activity, BrainCircuit, ChevronRight, Cpu, Database, HardDrive, MemoryStick, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INITIAL_MESSAGES: Message[] = [
  {
    role: "system",
    content:
      "You are SmolLM2, a concise and helpful local assistant. Use Markdown when it improves clarity and do not claim to use online resources.",
  },
];

const QUICK_PROMPTS = [
  "Explain RAM usage in a Docker container.",
  "Write a Python function that checks for palindromes.",
  "Summarize why small language models are useful.",
];

function formatBytes(value?: number) {
  if (value === undefined || value <= 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB"];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** unitIndex).toFixed(unitIndex >= 2 ? 1 : 0)} ${units[unitIndex]}`;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="terminal-metric">
      <Icon className="size-4" aria-hidden="true" />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [lastPeakRam, setLastPeakRam] = useState<number>();
  const [lastLatency, setLastLatency] = useState<number>();
  const utils = trpc.useUtils();
  const statusQuery = trpc.model.status.useQuery(undefined, { refetchInterval: 4_000 });
  const status = statusQuery.data;

  const chatMutation = trpc.model.chat.useMutation({
    onSuccess: result => {
      setMessages(current => [...current, { role: "assistant", content: result.response }]);
      setLastPeakRam(result.metrics.modelProcessPeakRamBytes);
      setLastLatency(result.metrics.generationElapsedMs);
      void utils.model.status.invalidate();
    },
    onError: error => {
      toast.error("Inference process failed", { description: error.message });
    },
  });

  const handleSend = (content: string) => {
    if (!isReady) {
      toast.info("Model is not ready", { description: status?.detail || "The baked model is still being verified." });
      return;
    }
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    chatMutation.mutate({ messages: nextMessages });
  };

  const isReady = status?.ready;
  const isUnavailable = status?.status === "unavailable";
  const statusLabel = isReady ? "ONLINE" : isUnavailable ? "UNAVAILABLE" : "CHECKING";
  const memory = status?.memory;
  const systemUsed = memory ? memory.systemTotalBytes - memory.systemFreeBytes : undefined;
  const ramPercent = memory && memory.systemTotalBytes > 0 ? Math.round(((systemUsed || 0) / memory.systemTotalBytes) * 100) : 0;

  return (
    <div className="terminal-app min-h-screen text-foreground">
      <header className="terminal-topbar">
        <div className="flex items-center gap-3">
          <div className="terminal-mark" aria-hidden="true">
            <Terminal className="size-5" />
          </div>
          <div>
            <p className="terminal-kicker">LOCAL / CPU / PRIVATE</p>
            <h1>SmolLM2 <span>Inference Window</span></h1>
          </div>
        </div>
        <div className="terminal-status" aria-live="polite">
          <span className={`status-light ${isReady ? "is-ready" : "is-waiting"}`} />
          <span>{isReady ? "MODEL_READY" : status?.status === "unavailable" ? "MODEL_UNAVAILABLE" : "INITIALIZING"}</span>
        </div>
      </header>

      <main className="terminal-shell">
        <aside className="terminal-sidebar" aria-label="Model runtime information">
          <section>
            <p className="terminal-section-title"><ChevronRight className="size-3" /> Runtime</p>
            <div className="terminal-identity">
              <BrainCircuit className="size-6" aria-hidden="true" />
              <div>
                <strong>SmolLM2 135M</strong>
                <span>Instruct variant</span>
              </div>
            </div>
            <div className="terminal-chip-row">
              <Badge variant="outline">CPU only</Badge>
              <Badge variant="outline">Transformers</Badge>
              <Badge variant="outline">Local weights</Badge>
            </div>
          </section>

          <section className="terminal-status-card">
            <div className="flex items-center justify-between gap-3">
              <span className="terminal-label">MODEL STATUS</span>
              <span className={isReady ? "text-emerald-300" : isUnavailable ? "text-red-300" : "text-amber-300"}>{statusLabel}</span>
            </div>
            <p>{status?.detail || "Contacting local inference process…"}</p>
            <div className="terminal-path"><Database className="size-3" /> {status?.modelDirectory || "models/SmolLM2-135M-Instruct"}</div>
          </section>

          <section>
            <p className="terminal-section-title"><ChevronRight className="size-3" /> Memory monitor</p>
            <div className="terminal-metrics-grid">
              <Metric label="NODE RSS" value={formatBytes(memory?.processRssBytes)} icon={MemoryStick} />
              <Metric label="MODEL PEAK" value={formatBytes(lastPeakRam)} icon={BrainCircuit} />
              <Metric label="SYSTEM USED" value={formatBytes(systemUsed)} icon={HardDrive} />
              <Metric label="LAST RUN" value={lastLatency ? `${(lastLatency / 1000).toFixed(1)} s` : "—"} icon={Activity} />
            </div>
            <div className="terminal-memory-bar" aria-label={`System memory use: ${ramPercent}%`}>
              <div style={{ width: `${ramPercent}%` }} />
            </div>
            <p className="terminal-memory-caption">{ramPercent}% of detected system RAM in use</p>
          </section>

          <footer>
            <Cpu className="size-4" />
            <span>RUNNING ON CPU · NO GPU REQUIRED</span>
          </footer>
        </aside>

        <section className="terminal-main" aria-label="Chat window">
          <div className="terminal-main-header">
            <div>
              <p className="terminal-kicker">CONVERSATION BUFFER</p>
              <h2>Ask the local model</h2>
            </div>
            <span className="terminal-count">{Math.max(0, messages.length - 1).toString().padStart(2, "0")} MSGS</span>
          </div>

          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={chatMutation.isPending}
            height="min(67vh, 680px)"
            placeholder={isReady ? "Write a prompt, then press Enter…" : "Waiting for the baked model to become ready…"}
            emptyStateMessage="The local context buffer is empty. Start a conversation."
            suggestedPrompts={QUICK_PROMPTS}
            className="terminal-chat !rounded-none !border-[#254038] !bg-[#09100e]/85"
          />
          <p className="terminal-hint"><span>ENTER</span> send&nbsp;&nbsp; <span>SHIFT + ENTER</span> newline&nbsp;&nbsp; <span>MARKDOWN</span> rendered locally</p>
        </section>
      </main>
    </div>
  );
}
