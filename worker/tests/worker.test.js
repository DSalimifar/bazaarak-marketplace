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
  const res = await worker.fetch(new Request("http://localhost/api/orders"), {});
  assert.equal(res.status, 501);
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
