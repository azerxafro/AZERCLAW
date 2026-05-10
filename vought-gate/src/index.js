export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // ─── ADMIN: Rotate Keys ──────────────────────────────────────────
    // This endpoint allows the Azerclaw agent to trigger a key rotation
    if (request.method === "POST" && url.pathname.endsWith("/admin/rotate")) {
      return await this.handleRotation(env);
    }

    // ─── PROXY: AI Completions ───────────────────────────────────────
    if (request.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
      return new Response("Vought Gate: Unauthorized or Invalid Endpoint", { status: 403 });
    }

    const ACCOUNT_ID = env.CF_ACCOUNT_ID;
    const API_TOKEN = env.CF_API_TOKEN;

    if (!ACCOUNT_ID || !API_TOKEN) {
      return new Response("Vought Gate: Server Configuration Error (No Token)", { status: 500 });
    }

    const aiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/v1/chat/completions`;

    const FREE_MODELS = [
      "@cf/moonshotai/kimi-k2.6",
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3.1-70b-instruct",
      "@cf/mistralai/mistral-7b-instruct-v0.3",
      "@cf/google/gemma-7b-it",
      "@cf/qwen/qwen1.5-7b-chat",
      "@cf/microsoft/phi-2"
    ];

    try {
      const body = await request.json();
      
      // If requested model is not in whitelist, force default
      if (!body.model || !FREE_MODELS.includes(body.model)) {
        body.model = "@cf/moonshotai/kimi-k2.6";
      }

      const response = await fetch(aiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // If we hit a 401/403, we might need to roll keys
      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ 
          error: "VOUGHT_GATE_AUTH_FAILURE", 
          message: "API Key failed. Please trigger rotation." 
        }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } catch (e) {
      return new Response(`Vought Gate Error: ${e.message}`, { status: 500 });
    }
  },

  /**
   * Automates the rolling of Cloudflare API keys using the Master Key.
   */
  async handleRotation(env) {
    const MASTER_KEY = env.VOUGHT_MASTER_KEY;
    const ACCOUNT_ID = env.CF_ACCOUNT_ID;

    if (!MASTER_KEY) return new Response("No Master Key configured", { status: 500 });

    try {
      // 1. Create a fresh token with Workers AI permissions
      // Note: This requires the Master Key to have 'API Tokens:Edit' permissions.
      const createTokenRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MASTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Vought-Auto-Roll-${Date.now()}`,
          policies: [
            {
              effect: "allow",
              resources: { [`com.cloudflare.api.account.${ACCOUNT_ID}`]: "*" },
              permission_groups: [
                { id: "1314b9a159934273934375b43085600c", name: "Workers AI Read" },
                { id: "068c2275475143a59336113b28b7e2a9", name: "Workers AI Write" }
              ]
            }
          ]
        })
      });

      const tokenData = await createTokenRes.json();
      if (!tokenData.success) throw new Error(`Token creation failed: ${JSON.stringify(tokenData.errors)}`);

      const newKey = tokenData.result.value;

      // 2. Update the secret in the worker itself
      // This is the "Diabolical" part: the worker calls the Cloudflare API to update its own secret.
      const updateSecretRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/vought-gate/secrets`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${MASTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "CF_API_TOKEN",
          text: newKey,
          type: "secret_text"
        })
      });

      const updateData = await updateSecretRes.json();
      if (!updateData.success) throw new Error(`Secret update failed: ${JSON.stringify(updateData.errors)}`);

      return new Response(JSON.stringify({ success: true, message: "Keys rolled successfully. Vought Gate is back online." }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(`Rotation Failed: ${e.message}`, { status: 500 });
    }
  }
};
