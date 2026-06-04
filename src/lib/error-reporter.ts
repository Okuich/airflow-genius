// Lightweight error reporter — sends unhandled errors to client_error_log.
// Best-effort: never throws, fails silent if user is unauthenticated or DB unreachable.
import { supabase } from "@/integrations/supabase/client";

interface ReportInput {
  message: string;
  stack?: string;
  severity?: "error" | "warning" | "info";
  context?: Record<string, unknown>;
}

let _lastSent = 0;
const MIN_INTERVAL_MS = 2000; // throttle to avoid spam loops

export async function reportError(input: ReportInput): Promise<void> {
  const now = Date.now();
  if (now - _lastSent < MIN_INTERVAL_MS) return;
  _lastSent = now;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // RLS requires authenticated; skip anonymous

    await supabase.from("client_error_log").insert([{
      user_id: user.id,
      route: typeof window !== "undefined" ? window.location.pathname : null,
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000) ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      severity: input.severity ?? "error",
      context: (input.context ?? {}) as never,
    }]);
  } catch {
    // intentional: never let error reporter throw
  }
}

export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    void reportError({
      message: e.message || "Unknown window error",
      stack: e.error?.stack,
      severity: "error",
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    void reportError({ message: `Unhandled rejection: ${msg}`, stack, severity: "error" });
  });
}
