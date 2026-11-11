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

    if (request.method === "GET" && url.pathname === "/api/categories") {
      if (!env.DB) return json({ error: "Database not configured" }, 503);
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, title FROM categories WHERE is_active = 1 ORDER BY title ASC"
        ).all();
        return json({ categories: results || [] });
      } catch {
        return json({ error: "Failed to fetch categories" }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/products") {
      if (!env.DB) return json({ error: "Database not configured" }, 503);
      try {
        const { results } = await env.DB.prepare(
          "SELECT p.id, p.title, p.price_irr, p.stock, p.city_code, p.city_name, c.title AS category " +
          "FROM products p LEFT JOIN categories c ON p.category_id = c.id " +
          "WHERE p.status = 'active' ORDER BY p.created_at DESC LIMIT 50"
        ).all();
        return json({ products: results || [] });
      } catch {
        return json({ error: "Failed to fetch products" }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/overview") {
      const authHeader = request.headers.get("Authorization") || "";
      const expectedSecret = env.ADMIN_API_KEY || env.SESSION_SECRET;
      if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        return json({ error: "Unauthorized" }, 401);
      }

      if (!env.DB) return json({ error: "Database not configured" }, 503);
      try {
        const usersCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
        const productsCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM products").first();
        const ordersCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM orders").first();
        const adminUsers = await env.DB.prepare(
          "SELECT id, display_name, phone, role, status FROM users WHERE role = 'admin'"
        ).all();

        return json({
          overview: {
            users_count: usersCount?.total || 0,
            products_count: productsCount?.total || 0,
            orders_count: ordersCount?.total || 0,
            admins: adminUsers?.results || []
          }
        });
      } catch {
        return json({ error: "Failed to retrieve admin overview" }, 500);
      }
    }

    // Other business endpoints remain disabled until full authentication and authorization exist.
    return json({ error: "API route not implemented", path: url.pathname }, 501);
  }
};
