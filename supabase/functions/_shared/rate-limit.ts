// Shared rate-limit helper for edge functions.
// Uses private.check_rate_limit SQL function (sliding window via service role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitOptions {
  /** Unique key (e.g. `agent-diagnose:<org_id>` or `agent-diagnose:<user_id>`). */
  key: string;
  /** Max requests allowed within window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
  return _admin;
}

/** Returns true when the call is allowed, false when rate-limited. */
export async function checkRateLimit(opts: RateLimitOptions): Promise<boolean> {
  try {
    const { data, error } = await admin().schema("private").rpc("check_rate_limit", {
      _bucket_key: opts.key,
      _limit: opts.limit,
      _window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.error("rate-limit error", error);
      return true; // fail-open to avoid blocking on infra issues
    }
    return data === true;
  } catch (e) {
    console.error("rate-limit exception", e);
    return true;
  }
}

export function rateLimitedResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    }
  );
}
