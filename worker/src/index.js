// API scaffold only. Do not deploy as a production marketplace yet.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export const json = (data, status = 200, customHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...customHeaders
    }
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, service: "marketplace-api", stage: "scaffold" });
    }

    // Implement authentication and authorization before exposing business routes.
    // Never trust user_id, seller_id, price, role, or order status supplied by a client.
    return json({ error: "API route not implemented", path: url.pathname }, 501);
  }
};
