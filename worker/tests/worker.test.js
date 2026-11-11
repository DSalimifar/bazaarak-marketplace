import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  hashPassword,
  verifyPassword,
  normalizeIranianPhone,
  validatePassword
} from "../src/index.js";
import { createSignedUploadUrl, createSignedDownloadUrl } from "../src/supabase-storage.js";

const envSecret = "test-session-secret-that-is-at-least-32-chars";

test("health checks D1 successfully", async () => {
  const DB = { prepare: sql => ({ first: async () => {
    assert.equal(sql, "SELECT 1 AS db_ok");
    return { db_ok: 1 };
  } }) };
  const res = await worker.fetch(new Request("https://market.example/api/health"), { DB });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).database, "connected");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("health reports missing D1 binding", async () => {
  const res = await worker.fetch(new Request("https://market.example/api/health"), {});
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "پایگاه داده در دسترس نیست.");
});

test("OPTIONS does not enable wildcard CORS", async () => {
  const res = await worker.fetch(new Request("https://market.example/api/auth/login", { method: "OPTIONS" }), {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

test("cross-site mutation requests are rejected", async () => {
  const DB = { prepare: () => ({}) };
  const res = await worker.fetch(new Request("https://market.example/api/auth/login", {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "09123456789", password: "a-long-password" })
  }), { DB });
  assert.equal(res.status, 403);
});

test("unknown API routes return 404", async () => {
  const DB = { prepare: () => ({}) };
  const res = await worker.fetch(new Request("https://market.example/api/orders"), { DB });
  assert.equal(res.status, 404);
});

test("non-API requests are served by Static Assets", async () => {
  const request = new Request("https://market.example/");
  const ASSETS = { fetch: async received => {
    assert.equal(received.url, request.url);
    return new Response("marketplace home", { status: 200 });
  } };
  const res = await worker.fetch(request, { ASSETS });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "marketplace home");
});

test("non-API requests return 404 without Static Assets binding", async () => {
  const res = await worker.fetch(new Request("https://market.example/"), {});
  assert.equal(res.status, 404);
});

test("Iranian mobile numbers normalize Persian, Arabic, and international formats", () => {
  assert.equal(normalizeIranianPhone("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(normalizeIranianPhone("٠٩١٢٣٤٥٦٧٨٩"), "09123456789");
  assert.equal(normalizeIranianPhone("+989123456789"), "09123456789");
  assert.equal(normalizeIranianPhone("00989123456789"), "09123456789");
  assert.equal(normalizeIranianPhone("0912345"), null);
});

test("password policy requires 12 to 128 characters", () => {
  assert.equal(validatePassword("short"), false);
  assert.equal(validatePassword("a-secure-password"), true);
  assert.equal(validatePassword("x".repeat(129)), false);
});

test("passwords are PBKDF2-hashed and verified without storing plaintext", async () => {
  const password = "a-long-test-password-123";
  const stored = await hashPassword(password);
  assert.match(stored, /^pbkdf2_sha256\$310000\$/);
  assert.notEqual(stored, password);
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal(await verifyPassword("wrong-password", stored), false);
  assert.equal(await verifyPassword(password, "invalid-hash"), false);
});

test("auth endpoints require JSON content type", async () => {
  const DB = { prepare: () => ({}) };
  const res = await worker.fetch(new Request("https://market.example/api/auth/login", {
    method: "POST",
    body: "phone=09123456789&password=anything"
  }), { DB });
  assert.equal(res.status, 400);
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


test("JSON null and array bodies are rejected cleanly", async () => {
  const DB = { prepare: () => ({}) };
  for (const body of ["null", "[]"]) {
    const res = await worker.fetch(new Request("https://market.example/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }), { DB });
    assert.equal(res.status, 400);
  }
});
