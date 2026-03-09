import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Derive AES-256 key from service role key using HMAC-SHA256
async function deriveKey(): Promise<CryptoKey> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serviceKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const derived = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode("flowforge-trade-secret-vault-v1")
  );
  return crypto.subtle.importKey("raw", derived, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decrypt(
  ciphertext: string,
  ivB64: string,
  key: CryptoKey
): Promise<string> {
  const encrypted = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use the user's JWT for RLS enforcement
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    const aesKey = await deriveKey();

    if (action === "encrypt_and_store") {
      const {
        organization_id,
        title,
        description,
        content,
        classification,
        category,
        related_invention,
        access_level,
      } = params;

      const { ciphertext, iv } = await encrypt(content, aesKey);

      const { data, error } = await supabase
        .from("trade_secrets")
        .insert({
          organization_id,
          title,
          description,
          encrypted_content: ciphertext,
          encryption_iv: iv,
          classification: classification || "confidential",
          category: category || "threshold",
          related_invention,
          access_level: access_level || "owner_only",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "decrypt") {
      const { id } = params;

      // Fetch the secret (RLS enforces owner-only access)
      const { data, error } = await supabase
        .from("trade_secrets")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Secret not found or access denied" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const plaintext = await decrypt(
        data.encrypted_content,
        data.encryption_iv,
        aesKey
      );

      // Log the access
      await supabase.from("trade_secret_access_log").insert({
        trade_secret_id: id,
        user_id: user.id,
        action: "decrypt",
      });

      // Update last_accessed
      await supabase
        .from("trade_secrets")
        .update({
          last_accessed_at: new Date().toISOString(),
          last_accessed_by: user.id,
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, content: plaintext }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "list") {
      const { organization_id } = params;

      // RLS ensures only owners see this
      const { data, error } = await supabase
        .from("trade_secrets")
        .select(
          "id, title, description, classification, category, related_invention, access_level, created_at, updated_at, last_accessed_at"
        )
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ secrets: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = params;
      const { error } = await supabase
        .from("trade_secrets")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
