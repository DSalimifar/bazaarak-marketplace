const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export const json = (data, status = 200, customHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders, ...customHeaders }
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      if (!env.DB) return json({ ok: false, service: "marketplace-api", database: "not_configured" }, 503);
      try {
        const result = await env.DB.prepare("SELECT 1 AS db_ok").first();
        if (result?.db_ok !== 1) throw new Error("Unexpected D1 response");
        return json({ ok: true, service: "marketplace-api", database: "connected" });
      } catch {
        return json({ ok: false, service: "marketplace-api", database: "query_failed" }, 503);
      }
    }

    // Business endpoints remain disabled until authentication and authorization exist.
    return json({ error: "API route not implemented", path: url.pathname }, 501);
  }
};
