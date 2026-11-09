import test from "node:test";
import assert from "node:assert/strict";
import worker, { json } from "../src/index.js";
import { createSignedUploadUrl, createSignedDownloadUrl } from "../src/supabase-storage.js";

test("GET /api/health returns 200 with ok: true and CORS header", async () => {
  const req = new Request("http://localhost/api/health", { method: "GET" });
  const res = await worker.fetch(req, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.service, "marketplace-api");
});

test("OPTIONS request returns 204 with CORS headers", async () => {
  const req = new Request("http://localhost/api/some-endpoint", { method: "OPTIONS" });
  const res = await worker.fetch(req, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.equal(res.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
});

test("Unimplemented routes return 501", async () => {
  const req = new Request("http://localhost/api/orders", { method: "GET" });
  const res = await worker.fetch(req, {});
  assert.equal(res.status, 501);
  const data = await res.json();
  assert.equal(data.error, "API route not implemented");
  assert.equal(data.path, "/api/orders");
});

test("supabase-storage throws error when env is not configured", async () => {
  await assert.rejects(
    async () => {
      await createSignedUploadUrl({}, "payment-receipts", "receipts/1.jpg");
    },
    {
      name: "Error",
      message: "Supabase Storage is not configured"
    }
  );

  await assert.rejects(
    async () => {
      await createSignedDownloadUrl({ SUPABASE_URL: "https://example.supabase.co" }, "payment-receipts", "receipts/1.jpg");
    },
    {
      name: "Error",
      message: "Supabase Storage is not configured"
    }
  );
});

test("supabase-storage sends correct request to Supabase REST API", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = "";
    let capturedOptions = {};

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return new Response(JSON.stringify({ url: "https://signed-url.example.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    const env = {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret-key-123"
    };

    const res = await createSignedUploadUrl(env, "payment-receipts", "receipts/order-1/file.jpg");
    assert.equal(res.url, "https://signed-url.example.com");
    assert.equal(
      capturedUrl,
      "https://test.supabase.co/storage/v1/object/upload/sign/payment-receipts/receipts/order-1/file.jpg"
    );
    assert.equal(capturedOptions.headers["Authorization"], "Bearer secret-key-123");
    assert.equal(capturedOptions.headers["apikey"], "secret-key-123");

    const dlRes = await createSignedDownloadUrl(env, "payment-receipts", "receipts/order-1/file.jpg", 300);
    assert.equal(dlRes.url, "https://signed-url.example.com");
    assert.equal(
      capturedUrl,
      "https://test.supabase.co/storage/v1/object/sign/payment-receipts/receipts/order-1/file.jpg"
    );
    assert.equal(JSON.parse(capturedOptions.body).expiresIn, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
