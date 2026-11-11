const SESSION_COOKIE = "__Host-bazaarak_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 310000;
const encoder = new TextEncoder();

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY"
};

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...securityHeaders, ...headers }
});

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64Url(bytes);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function keyedHash(env, value) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}

export function normalizeIranianPhone(value) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  let phone = String(value ?? "").trim();
  phone = [...phone].map(char => {
    const p = persian.indexOf(char);
    if (p >= 0) return String(p);
    const a = arabic.indexOf(char);
    return a >= 0 ? String(a) : char;
  }).join("").replace(/[\s()-]/g, "");
  if (phone.startsWith("+98")) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith("0098")) phone = `0${phone.slice(4)}`;
  return /^09\d{9}$/.test(phone) ? phone : null;
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

export async function hashPassword(password) {
  if (!validatePassword(password)) throw new Error("Password must be 12 to 128 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 600000) return false;
  try {
    const salt = base64UrlToBytes(parts[2]);
    const expected = base64UrlToBytes(parts[3]);
    if (salt.length !== 16 || expected.length !== 32) return false;
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i];
    return difference === 0;
  } catch {
    return false;
  }
}

function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
  }
  return null;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function readJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return { error: "درخواست باید با فرمت JSON ارسال شود." };
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16384) return { error: "حجم درخواست بیش از حد مجاز است." };
  try {
    const text = await request.text();
    if (text.length > 16384) return { error: "حجم درخواست بیش از حد مجاز است." };
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "بدنه درخواست باید یک شیء JSON معتبر باشد." };
    }
    return parsed;
  } catch {
    return { error: "ساختار JSON معتبر نیست." };
  }
}

function validText(value, max = 100) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

function requestIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

async function enforceRateLimit(env, key, maxAttempts, windowSeconds) {
  const keyHash = await keyedHash(env, key);
  const row = await env.DB.prepare(`
    INSERT INTO auth_rate_limits (key_hash, attempts, window_started_at)
    VALUES (?, 1, datetime('now'))
    ON CONFLICT(key_hash) DO UPDATE SET
      attempts = CASE
        WHEN datetime(auth_rate_limits.window_started_at, '+' || ? || ' seconds') <= datetime('now') THEN 1
        ELSE auth_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN datetime(auth_rate_limits.window_started_at, '+' || ? || ' seconds') <= datetime('now') THEN datetime('now')
        ELSE auth_rate_limits.window_started_at
      END
    RETURNING attempts
  `).bind(keyHash, windowSeconds, windowSeconds).first();
  return Number(row?.attempts || 0) <= maxAttempts;
}

async function getSessionUser(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || !env.SESSION_SECRET) return null;
  const tokenHash = await keyedHash(env, token);
  const user = await env.DB.prepare(`
    SELECT u.id, u.phone, u.display_name, u.city_code, u.city_name, u.role, u.status,
           s.id AS session_id
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now') AND u.status = 'active'
    LIMIT 1
  `).bind(tokenHash).first();
  if (!user) return null;
  await env.DB.prepare("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(user.session_id).run();
  delete user.session_id;
  return user;
}

async function requireUser(request, env) {
  return getSessionUser(request, env);
}

function userPayload(user) {
  return {
    id: user.id,
    phone: user.phone,
    display_name: user.display_name,
    city_code: user.city_code,
    city_name: user.city_name,
    role: user.role,
    status: user.status
  };
}

async function createSession(request, env, userId) {
  const token = randomToken(32);
  const tokenHash = await keyedHash(env, token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  const ipHash = await keyedHash(env, requestIp(request));
  await env.DB.prepare(`
    INSERT INTO auth_sessions (id, token_hash, user_id, expires_at, ip_hash, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, tokenHash, userId, expiresAt, ipHash, (request.headers.get("User-Agent") || "").slice(0, 300)).run();
  return sessionCookie(token);
}

async function register(request, env) {
  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, 400);
  const phone = normalizeIranianPhone(body.phone);
  if (!phone) return json({ error: "شماره موبایل معتبر نیست." }, 400);
  if (!validatePassword(body.password)) return json({ error: "رمز عبور باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد." }, 400);
  if (!validText(body.display_name, 80) || !validText(body.city_code, 20) || !validText(body.city_name, 80)) {
    return json({ error: "نام نمایشی و اطلاعات شهر الزامی است." }, 400);
  }
  if (!validText(body.invitation_code, 160)) return json({ error: "کد دعوت الزامی است." }, 400);
  if (!await enforceRateLimit(env, `register:${requestIp(request)}`, 8, 3600)) {
    return json({ error: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, 429);
  }
  const invitationHash = await keyedHash(env, body.invitation_code.trim());
  const existing = await env.DB.prepare("SELECT id FROM users WHERE phone = ? LIMIT 1").bind(phone).first();
  if (existing) return json({ error: "این شماره موبایل قبلاً ثبت شده است." }, 409);
  const passwordHash = await hashPassword(body.password);
  const userId = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO users (id, phone, display_name, city_code, city_name, role, status, password_hash)
      SELECT ?, ?, ?, ?, ?, role, 'active', ?
      FROM invitations
      WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')
    `).bind(userId, phone, body.display_name.trim(), body.city_code.trim(), body.city_name.trim(), passwordHash, invitationHash),
    env.DB.prepare(`
      UPDATE invitations SET used_at = CURRENT_TIMESTAMP, used_by = ?
      WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')
        AND EXISTS (SELECT 1 FROM users WHERE id = ?)
    `).bind(userId, invitationHash, userId),
    env.DB.prepare(`
      DELETE FROM users WHERE id = ? AND NOT EXISTS (
        SELECT 1 FROM invitations WHERE token_hash = ? AND used_by = ?
      )
    `).bind(userId, invitationHash, userId)
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1 || Number(results?.[1]?.meta?.changes || 0) !== 1) {
    return json({ error: "کد دعوت نامعتبر، منقضی یا قبلاً استفاده شده است؛ یا شماره موبایل تکراری است." }, 409);
  }
  const cookie = await createSession(request, env, userId);
  const user = await env.DB.prepare("SELECT id, phone, display_name, city_code, city_name, role, status FROM users WHERE id = ?")
    .bind(userId).first();
  return json({ ok: true, user: userPayload(user) }, 201, { "Set-Cookie": cookie });
}

async function login(request, env) {
  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, 400);
  const phone = normalizeIranianPhone(body.phone);
  if (!phone || typeof body.password !== "string" || body.password.length > 128) {
    return json({ error: "شماره موبایل یا رمز عبور نادرست است." }, 400);
  }
  const ip = requestIp(request);
  const allowedIp = await enforceRateLimit(env, `login-ip:${ip}`, 30, 900);
  const allowedPhone = await enforceRateLimit(env, `login-phone:${phone}`, 10, 900);
  if (!allowedIp || !allowedPhone) return json({ error: "تلاش‌های ورود بیش از حد مجاز است. ۱۵ دقیقه بعد دوباره تلاش کنید." }, 429);
  const user = await env.DB.prepare(`
    SELECT id, phone, display_name, city_code, city_name, role, status, password_hash
    FROM users WHERE phone = ? LIMIT 1
  `).bind(phone).first();
  const valid = user && user.status === "active" && user.password_hash
    ? await verifyPassword(body.password, user.password_hash)
    : false;
  if (!valid) return json({ error: "شماره موبایل یا رمز عبور نادرست است." }, 401);
  const cookie = await createSession(request, env, user.id);
  delete user.password_hash;
  return json({ ok: true, user: userPayload(user) }, 200, { "Set-Cookie": cookie });
}

async function bootstrapAdmin(request, env) {
  if (!env.BOOTSTRAP_ADMIN_SECRET || env.BOOTSTRAP_ADMIN_SECRET.length < 32) {
    return json({ error: "راه‌اندازی مدیر اولیه در Worker پیکربندی نشده است." }, 503);
  }
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!constantTimeEqual(supplied, env.BOOTSTRAP_ADMIN_SECRET)) return json({ error: "دسترسی غیرمجاز است." }, 401);
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'").first();
  if (Number(count?.total || 0) > 0) return json({ error: "مدیر اولیه قبلاً ایجاد شده است." }, 409);
  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, 400);
  const phone = normalizeIranianPhone(body.phone);
  if (!phone || !validatePassword(body.password) || !validText(body.display_name, 80)
      || !validText(body.city_code, 20) || !validText(body.city_name, 80)) {
    return json({ error: "اطلاعات مدیر معتبر نیست؛ رمز باید حداقل ۱۲ نویسه باشد." }, 400);
  }
  const passwordHash = await hashPassword(body.password);
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, phone, display_name, city_code, city_name, role, status, password_hash)
    SELECT ?, ?, ?, ?, ?, 'admin', 'active', ?
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
  `).bind(id, phone, body.display_name.trim(), body.city_code.trim(), body.city_name.trim(), passwordHash).run();
  if (Number(result?.meta?.changes || 0) !== 1) return json({ error: "مدیر ایجاد نشد؛ شماره ممکن است تکراری باشد یا مدیر دیگری هم‌زمان ایجاد شده باشد." }, 409);
  return json({ ok: true, message: "مدیر اولیه ایجاد شد. اکنون Secret راه‌اندازی را از تنظیمات Worker حذف کنید." }, 201);
}

async function createInvitation(request, env, admin) {
  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, 400);
  const role = body.role || "buyer";
  const hours = body.expires_in_hours === undefined ? 168 : Number(body.expires_in_hours);
  if (!['buyer', 'seller'].includes(role) || !Number.isInteger(hours) || hours < 1 || hours > 720) {
    return json({ error: "نقش یا مدت اعتبار کد دعوت معتبر نیست." }, 400);
  }
  const code = randomToken(24);
  const tokenHash = await keyedHash(env, code);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO invitations (id, token_hash, invited_by, expires_at, role)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, tokenHash, admin.id, expiresAt, role).run();
  return json({ ok: true, invitation: { id, code, role, expires_at: expiresAt } }, 201);
}

async function handleApi(request, env, url) {
  if (!url.pathname.startsWith("/api/")) return null;
  if (!env.DB) return json({ error: "پایگاه داده در دسترس نیست." }, 503);
  if (request.method === "GET" && url.pathname === "/api/health") {
    try {
      const result = await env.DB.prepare("SELECT 1 AS db_ok").first();
      if (result?.db_ok !== 1) throw new Error("D1 health query failed");
      return json({ ok: true, service: "marketplace-api", database: "connected" });
    } catch {
      return json({ ok: false, service: "marketplace-api", database: "query_failed" }, 503);
    }
  }
  if (request.method === "POST" && ["/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/admin/bootstrap", "/api/admin/invitations"].includes(url.pathname)) {
    const origin = request.headers.get("Origin");
    const fetchSite = request.headers.get("Sec-Fetch-Site");
    let originMismatch = false;
    if (origin) {
      try { originMismatch = new URL(origin).origin !== url.origin; }
      catch { originMismatch = true; }
    }
    if (originMismatch || fetchSite === "cross-site") {
      return json({ error: "درخواست بین‌سایتی پذیرفته نیست." }, 403);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/auth/register") return register(request, env);
  if (request.method === "POST" && url.pathname === "/api/auth/login") return login(request, env);
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = cookieValue(request, SESSION_COOKIE);
    if (token && env.SESSION_SECRET) {
      const tokenHash = await keyedHash(env, token);
      await env.DB.prepare("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL")
        .bind(tokenHash).run();
    }
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }
  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const user = await requireUser(request, env);
    return user ? json({ ok: true, user: userPayload(user) }) : json({ error: "برای ادامه وارد حساب شوید." }, 401);
  }
  if (request.method === "POST" && url.pathname === "/api/admin/bootstrap") return bootstrapAdmin(request, env);
  if (request.method === "POST" && url.pathname === "/api/admin/invitations") {
    const user = await requireUser(request, env);
    if (!user) return json({ error: "برای ادامه وارد حساب شوید." }, 401);
    if (user.role !== "admin") return json({ error: "اجازه انجام این عملیات را ندارید." }, 403);
    return createInvitation(request, env, user);
  }
  if (url.pathname.startsWith("/api/")) return json({ error: "مسیر API پیدا نشد." }, 404);
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: securityHeaders });
    try {
      const apiResponse = await handleApi(request, env, url);
      if (apiResponse) return apiResponse;
    } catch (error) {
      // Do not return internal SQL, credentials, or stack traces to clients.
      console.error("Marketplace API error:", error?.message || "unknown error");
      return json({ error: "خطای داخلی سرور رخ داد." }, 500);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not Found", { status: 404, headers: securityHeaders });
  }
};
