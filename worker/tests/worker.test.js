import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { createSignedUploadUrl, createSignedDownloadUrl } from "../src/supabase-storage.js";

test("health checks D1 successfully", async () => {
  const DB = { prepare: sql => ({ first: async () => {
    assert.equal(sql, "SELECT 1 AS db_ok");
    return { db_ok: 1 };
  }})};
  const res = await worker.fetch(new Request("http://localhost/api/health"), { DB });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).database, "connected");
});

test("health reports missing D1 binding", async () => {
  const res = await worker.fetch(new Request("http://localhost/api/health"), {});
  assert.equal(res.status, 503);
  assert.equal((await res.json()).database, "not_configured");
});

test("health reports D1 query failure", async () => {
  const DB = { prepare: () => ({ first: async () => { throw new Error("offline"); } }) };
  const res = await worker.fetch(new Request("http://localhost/api/health"), { DB });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).database, "query_failed");
});

test("OPTIONS returns CORS headers", async () => {
  const res = await worker.fetch(new Request("http://localhost/api/x", { method: "OPTIONS" }), {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("unimplemented API remains disabled", async () => {
  const res = await worker.fetch(new Request("http://localhost/api/unknown-route"), {});
  assert.equal(res.status, 501);
});

test("GET /api/categories returns categories from D1", async () => {
  const DB = {
    prepare: sql => ({
      all: async () => {
        assert.match(sql, /FROM categories/);
        return { results: [{ id: "cat_food", title: "خوراکی" }] };
      }
    })
  };
  const res = await worker.fetch(new Request("http://localhost/api/categories"), { DB });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.categories.length, 1);
  assert.equal(data.categories[0].title, "خوراکی");
});

test("GET /api/products returns active products from D1", async () => {
  const DB = {
    prepare: sql => ({
      all: async () => {
        assert.match(sql, /FROM products/);
        return { results: [{ id: "prod_1", title: "عسل کوهستان", price_irr: 500000 }] };
      }
    })
  };
  const res = await worker.fetch(new Request("http://localhost/api/products"), { DB });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].title, "عسل کوهستان");
});

test("GET /api/admin/overview rejects unauthenticated requests with 401", async () => {
  const res = await worker.fetch(new Request("http://localhost/api/admin/overview"), {
    ADMIN_API_KEY: "secret-token"
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, "Unauthorized");
});

test("GET /api/admin/overview returns dashboard counts and admin users when authorized", async () => {
  const DB = {
    prepare: sql => ({
      first: async () => ({ total: 10 }),
      all: async () => ({ results: [{ id: "usr_admin", display_name: "مدیر", role: "admin" }] })
    })
  };
  const req = new Request("http://localhost/api/admin/overview", {
    headers: { Authorization: "Bearer secret-token" }
  });
  const res = await worker.fetch(req, { DB, ADMIN_API_KEY: "secret-token" });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.overview.users_count, 10);
  assert.equal(data.overview.admins[0].display_name, "مدیر");
});

test("Supabase helpers reject missing configuration", async () => {
  await assert.rejects(() => createSignedUploadUrl({}, "payment-receipts", "receipts/a.jpg"),
    { message: "Supabase Storage is not configured" });
  await assert.rejects(() => createSignedDownloadUrl({ SUPABASE_URL: "https://example.supabase.co" },
    "payment-receipts", "receipts/a.jpg"), { message: "Supabase Storage is not configured" });
});

test("Supabase helpers call signed upload/download endpoints", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let lastUrl = "";
    let lastOptions = {};
    globalThis.fetch = async (url, options) => {
      lastUrl = url; lastOptions = options;
      return new Response(JSON.stringify({ url: "https://signed.example" }), { status: 200 });
    };
    const env = { SUPABASE_URL: "https://kzectbmyyychvoeffibh.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-secret" };
    await createSignedUploadUrl(env, "payment-receipts", "receipts/order/file.jpg");
    assert.match(lastUrl, /object\/upload\/sign\/payment-receipts/);
    assert.equal(lastOptions.headers.Authorization, "Bearer test-secret");
    await createSignedDownloadUrl(env, "payment-receipts", "receipts/order/file.jpg", 300);
    assert.match(lastUrl, /object\/sign\/payment-receipts/);
    assert.equal(JSON.parse(lastOptions.body).expiresIn, 300);
  } finally { globalThis.fetch = originalFetch; }
});
