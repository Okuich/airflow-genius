import type { ChatMessage, SimulationContext } from "./ai-chat-types";
import { generateMessageId, extractActions } from "./ai-chat-types";

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-message`;
const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-execute-plan`;

interface StreamChatOptions {
  messages: { role: string; content: string }[];
  simulationId?: string;
  simulationContext?: SimulationContext;
  onDelta: (text: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

async function streamFromEndpoint(
  url: string,
  body: Record<string, unknown>,
  opts: Pick<StreamChatOptions, "onDelta" | "onDone" | "onError" | "signal">
) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ error: "Request failed" }));
    opts.onError(errBody.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) {
    opts.onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        opts.onDone(fullContent);
        return;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullContent += content;
          opts.onDelta(content);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Final flush
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullContent += content;
          opts.onDelta(content);
        }
      } catch { /* ignore */ }
    }
  }

  opts.onDone(fullContent);
}

export async function streamAgentMessage(opts: StreamChatOptions) {
  return streamFromEndpoint(
    AGENT_URL,
    {
      messages: opts.messages,
      simulationId: opts.simulationId,
      simulationContext: opts.simulationContext,
    },
    opts
  );
}

export async function streamExecutePlan(
  planId: string,
  actions: { type: string; description: string; parameters?: Record<string, unknown> }[],
  simulationId: string | undefined,
  simulationContext: SimulationContext | undefined,
  opts: Pick<StreamChatOptions, "onDelta" | "onDone" | "onError" | "signal">
) {
  return streamFromEndpoint(
    EXECUTE_URL,
    { planId, actions, simulationId, simulationContext },
    opts
  );
}

export { generateMessageId, extractActions };
export type { ChatMessage };
