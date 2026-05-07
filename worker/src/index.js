// Cloudflare Worker that owns the OAuth renewal flow.
//
// Endpoints:
//   GET  /me        — returns the current visitor's session (cookie based)
//   GET  /start     — kicks off Google OAuth (with `popup=1` for popup mode)
//   GET  /callback  — Google redirects here; we exchange + write secret
//   POST /logout    — clears the session cookie
//
// On callback success the Worker:
//   1. updates the GitHub Secret  USER_<ID>_REFRESH_TOKEN  (sealed-box encrypted)
//   2. updates  data/status.json  with a fresh tokenIssuedAt
//   3. dispatches the "update.yml" workflow so videos refresh in ~30s
//   4. sets a long-lived signed session cookie identifying the visitor

import nacl from "tweetnacl";
import { blake2b } from "@noble/hashes/blake2b";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "openid",
  "email",
];

const COOKIE_NAME = "fls";
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 90;
const STATE_TTL_SECONDS = 600;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return preflight(request, env);
      switch (url.pathname) {
        case "/me":               return handleMe(request, env);
        case "/me/name":          return handleUpdateName(request, env);
        case "/me/disclose":      return handleUpdateDisclose(request, env);
        case "/me/avatar":        return handleUpdateAvatar(request, env);
        case "/me/react":         return handleReact(request, env);
        case "/push/subscribe":   return handlePushSubscribe(request, env);
        case "/push/unsubscribe": return handlePushUnsubscribe(request, env);
        case "/start":            return handleStart(url, env);
        case "/callback":         return handleCallback(url, env);
        case "/logout":           return handleLogout(request, env);
        case "/":
        case "":          return new Response("friend-likes worker", { status: 200 });
        default:          return new Response("not found", { status: 404 });
      }
    } catch (err) {
      console.error("worker:", err && err.stack || err);
      return errorPage("Something went wrong. " + (err.message || ""));
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runReminders(env).catch((e) => console.error("scheduled:", e)));
  },
};

// ---------------- CORS ----------------

function preflight(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin !== env.SITE_ORIGIN) {
    return new Response("CORS denied", { status: 403 });
  }
  return new Response(null, { status: 204, headers: cors(origin) });
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// ---------------- Endpoints ----------------

async function handleMe(request, env) {
  const origin = request.headers.get("Origin") || "";
  // Allow browsers to cache identity for 30s to reduce repeated /me roundtrips.
  // Cookie still validates each request after cache expiry.
  const headers = {
    ...cors(origin),
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=30",
  };
  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ signedIn: false }), { status: 200, headers });
  }
  return new Response(
    JSON.stringify({
      signedIn: true,
      userId: session.userId,
      name: session.name,
      tokenIssuedAt: session.tokenIssuedAt,
    }),
    { status: 200, headers }
  );
}

async function handleStart(url, env) {
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"), env);
  const popup = url.searchParams.get("popup") === "1";

  const state = {
    n: crypto.randomUUID(),
    returnTo,
    popup,
    exp: nowSec() + STATE_TTL_SECONDS,
  };
  const stateToken = await signToken(state, env);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.WORKER_ORIGIN}/callback`,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: stateToken,
  });
  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302
  );
}

async function handleCallback(url, env) {
  if (url.searchParams.get("error")) {
    return errorPage("サインインがキャンセルされたか失敗しました。");
  }
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code) return errorPage("Missing code.");

  const state = await verifyToken(stateRaw, env);
  if (!state) return errorPage("State が無効です。もう一度サインインしてください。");

  const tokens = await exchangeCode(code, env);
  if (!tokens.refresh_token) {
    return errorPage(
      "Google が refresh token を返しませんでした。<br>" +
      '<a href="https://myaccount.google.com/permissions" target="_blank" style="color:#ededed">myaccount.google.com/permissions</a> で当該アプリのアクセスを取り消した後、もう一度サインインしてください。'
    );
  }

  const email = await emailFromTokens(tokens);
  if (!email) return errorPage("メールアドレスが取得できませんでした。");

  const emailMap = parseJsonSafe(env.USER_EMAIL_MAP, {});
  const userId = emailMap[email.toLowerCase()];
  if (!userId) {
    return errorPage(
      `${escapeHtml(email)} は招待されていません。admin に連絡してください。`
    );
  }

  const users = parseJsonSafe(env.USERS_JSON, []);
  const name = users.find((u) => u.id === userId)?.name || userId;

  const tokenIssuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  // 1. Write the refresh token to GitHub Secrets
  await updateGithubSecret(
    env,
    `USER_${userId.toUpperCase()}_REFRESH_TOKEN`,
    tokens.refresh_token
  );

  // 2. Update data/status.json (best-effort; status display only)
  try {
    await updateStatusJson(env, userId, tokenIssuedAt);
  } catch (e) {
    console.warn("status.json update failed:", e.message);
  }

  // 3. Trigger the daily fetch workflow so this user's likes are pulled now
  try {
    await triggerWorkflow(env);
  } catch (e) {
    console.warn("workflow dispatch failed:", e.message);
  }

  // 4. Issue session cookie + show success page
  const session = {
    userId,
    name,
    email,
    tokenIssuedAt,
    exp: nowSec() + COOKIE_TTL_SECONDS,
  };
  const sessionToken = await signToken(session, env);

  return successPage(state, userId, name, sessionToken);
}

async function handleUpdateName(request, env) {
  const origin = request.headers.get("Origin") || "";
  const baseHeaders = { ...cors(origin), "Content-Type": "application/json" };

  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: baseHeaders,
    });
  }

  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), {
      status: 401, headers: baseHeaders,
    });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  const raw = body && typeof body.name === "string" ? body.name : "";
  const name = raw.trim();
  const codepoints = [...name].length;
  if (codepoints < 1 || codepoints > 4) {
    return new Response(JSON.stringify({ error: "invalid_length" }), {
      status: 400, headers: baseHeaders,
    });
  }

  try {
    await patchUsersJson(env, session.userId, { name }, `rename ${session.userId} -> ${name}`);
  } catch (e) {
    console.error("patchUsersJson(name):", e);
    return new Response(JSON.stringify({ error: "update_failed", detail: e.message }), {
      status: 500, headers: baseHeaders,
    });
  }

  // Re-issue cookie with new name
  const newSession = { ...session, name, exp: nowSec() + COOKIE_TTL_SECONDS };
  const newToken = await signToken(newSession, env);

  return new Response(JSON.stringify({ ok: true, name }), {
    status: 200,
    headers: { ...baseHeaders, "Set-Cookie": setCookieHeader(newToken) },
  });
}

async function handleUpdateDisclose(request, env) {
  const origin = request.headers.get("Origin") || "";
  const baseHeaders = { ...cors(origin), "Content-Type": "application/json" };

  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: baseHeaders,
    });
  }
  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), {
      status: 401, headers: baseHeaders,
    });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body.disclose !== "boolean") {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400, headers: baseHeaders,
    });
  }
  const disclose = body.disclose;

  try {
    await patchUsersJson(
      env,
      session.userId,
      { disclose },
      `disclose ${session.userId} -> ${disclose}`
    );
  } catch (e) {
    console.error("patchUsersJson(disclose):", e);
    return new Response(JSON.stringify({ error: "update_failed", detail: e.message }), {
      status: 500, headers: baseHeaders,
    });
  }
  return new Response(JSON.stringify({ ok: true, disclose }), {
    status: 200, headers: baseHeaders,
  });
}

async function handleUpdateAvatar(request, env) {
  const origin = request.headers.get("Origin") || "";
  const baseHeaders = { ...cors(origin), "Content-Type": "application/json" };

  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: baseHeaders,
    });
  }
  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), {
      status: 401, headers: baseHeaders,
    });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  const avatarId = body && typeof body.avatarId === "string" ? body.avatarId.trim() : "";
  if (!/^[a-z0-9_-]{1,16}$/.test(avatarId)) {
    return new Response(JSON.stringify({ error: "invalid_avatar" }), {
      status: 400, headers: baseHeaders,
    });
  }

  try {
    await patchUsersJson(env, session.userId, { avatarId },
      `avatar ${session.userId} -> ${avatarId}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: "update_failed", detail: e.message }), {
      status: 500, headers: baseHeaders,
    });
  }
  return new Response(JSON.stringify({ ok: true, avatarId }), {
    status: 200, headers: baseHeaders,
  });
}

// =============== Reactions ===============

const ALLOWED_REACTIONS = new Set(["fire", "lol", "eyes", "spark", "tear", "music"]);

async function handleReact(request, env) {
  const origin = request.headers.get("Origin") || "";
  const baseHeaders = { ...cors(origin), "Content-Type": "application/json" };

  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: baseHeaders,
    });
  }
  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), {
      status: 401, headers: baseHeaders,
    });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body) {
    return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: baseHeaders });
  }
  const videoId = String(body.videoId || "").slice(0, 32);
  const emoji = String(body.emoji || "");
  const on = !!body.on;
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(videoId) || !ALLOWED_REACTIONS.has(emoji)) {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: baseHeaders });
  }

  try {
    await patchReactions(env, videoId, emoji, session.userId, on);
  } catch (e) {
    return new Response(JSON.stringify({ error: "update_failed", detail: e.message }), {
      status: 500, headers: baseHeaders,
    });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: baseHeaders });
}

async function patchReactions(env, videoId, emoji, userId, on) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/reactions.json?ref=${branch}`;

  let sha = null;
  let current = {};
  const getResp = await fetch(url, { headers: ghHeaders(env) });
  if (getResp.ok) {
    const data = await getResp.json();
    sha = data.sha;
    try { current = JSON.parse(b64DecodeUtf8(data.content.replace(/\s/g, ""))) || {}; } catch {}
  } else if (getResp.status !== 404) {
    throw new Error(`get reactions.json ${getResp.status}: ${await getResp.text()}`);
  }

  if (!current[videoId]) current[videoId] = {};
  const v = current[videoId];
  if (!v[emoji]) v[emoji] = [];
  const had = v[emoji].includes(userId);
  if (on && !had) v[emoji].push(userId);
  else if (!on && had) v[emoji] = v[emoji].filter((u) => u !== userId);
  if (v[emoji].length === 0) delete v[emoji];
  if (Object.keys(v).length === 0) delete current[videoId];

  const newJson = JSON.stringify(current, null, 2) + "\n";
  const body = {
    message: `chore: react ${emoji} on ${videoId} by ${userId}`,
    content: b64EncodeUtf8(newJson),
    branch,
  };
  if (sha) body.sha = sha;

  // Retry on 409 conflict (sha mismatch)
  for (let attempt = 0; attempt < 3; attempt++) {
    const putResp = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/reactions.json`,
      {
        method: "PUT",
        headers: { ...ghHeaders(env), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (putResp.ok) return;
    if (putResp.status !== 409 && putResp.status !== 422) {
      throw new Error(`put reactions.json ${putResp.status}: ${await putResp.text()}`);
    }
    // Refresh sha and retry
    const re = await fetch(url, { headers: ghHeaders(env) });
    if (!re.ok) throw new Error(`refresh reactions.json ${re.status}`);
    const re2 = await re.json();
    body.sha = re2.sha;
  }
  throw new Error("reactions.json: max retries");
}

// =============== Push subscriptions ===============

async function handlePushSubscribe(request, env) {
  const origin = request.headers.get("Origin") || "";
  const baseHeaders = { ...cors(origin), "Content-Type": "application/json" };
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: baseHeaders });
  }
  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), { status: 401, headers: baseHeaders });
  }
  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body.endpoint !== "string" ||
      !body.keys || typeof body.keys.p256dh !== "string" || typeof body.keys.auth !== "string") {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: baseHeaders });
  }
  try {
    await patchPushFile(env, session.userId, body, "add");
  } catch (e) {
    return new Response(JSON.stringify({ error: "update_failed", detail: e.message }), { status: 500, headers: baseHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: baseHeaders });
}

async function handlePushUnsubscribe(request, env) {
  const origin = request.headers.get("Origin") || "";
  const baseHeaders = { ...cors(origin), "Content-Type": "application/json" };
  const session = await verifyToken(readCookie(request, COOKIE_NAME), env);
  if (!session) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), { status: 401, headers: baseHeaders });
  }
  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body.endpoint !== "string") {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: baseHeaders });
  }
  try {
    await patchPushFile(env, session.userId, body, "remove");
  } catch (e) {
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500, headers: baseHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: baseHeaders });
}

async function patchPushFile(env, userId, sub, op) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/push.json?ref=${branch}`;

  let sha = null;
  let current = {};
  const getResp = await fetch(url, { headers: ghHeaders(env) });
  if (getResp.ok) {
    const data = await getResp.json();
    sha = data.sha;
    try { current = JSON.parse(b64DecodeUtf8(data.content.replace(/\s/g, ""))) || {}; } catch {}
  } else if (getResp.status !== 404) {
    throw new Error(`get push.json ${getResp.status}`);
  }

  if (!current[userId]) current[userId] = [];
  const arr = current[userId];

  if (op === "add") {
    const idx = arr.findIndex((s) => s.endpoint === sub.endpoint);
    const entry = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
    if (idx >= 0) arr[idx] = entry;
    else arr.push(entry);
  } else {
    current[userId] = arr.filter((s) => s.endpoint !== sub.endpoint);
    if (current[userId].length === 0) delete current[userId];
  }

  const newJson = JSON.stringify(current, null, 2) + "\n";
  const body = {
    message: `chore: push ${op} ${userId}`,
    content: b64EncodeUtf8(newJson),
    branch,
  };
  if (sha) body.sha = sha;

  for (let attempt = 0; attempt < 3; attempt++) {
    const putResp = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/push.json`,
      {
        method: "PUT",
        headers: { ...ghHeaders(env), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (putResp.ok) return;
    if (putResp.status !== 409 && putResp.status !== 422) {
      throw new Error(`put push.json ${putResp.status}: ${await putResp.text()}`);
    }
    const re = await fetch(url, { headers: ghHeaders(env) });
    if (!re.ok) throw new Error(`refresh push.json ${re.status}`);
    body.sha = (await re.json()).sha;
  }
  throw new Error("push.json: max retries");
}

// =============== Scheduled (cron) — daily reminders ===============

async function runReminders(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const [usersResp, statusResp, pushResp] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/${branch}/data/users.json`),
    fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/${branch}/data/status.json`),
    fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/${branch}/data/push.json`),
  ]);
  if (!usersResp.ok) { console.warn("scheduled: users.json missing"); return; }
  const users = await usersResp.json();
  const status = statusResp.ok ? await statusResp.json() : { users: {} };
  const subsByUser = pushResp.ok ? await pushResp.json() : {};

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn("scheduled: VAPID keys not set, skipping push");
    return;
  }

  const now = Date.now();
  const sevenDays = 7 * 86400000;
  const tasks = [];

  for (const u of users) {
    const issuedAt = status?.users?.[u.id]?.tokenIssuedAt;
    if (!issuedAt) continue;
    const ageDays = (now - new Date(issuedAt).getTime()) / 86400000;
    const remaining = 7 - ageDays;
    // Trigger zones: <=3 days and <=1 day and expired
    let kind = null;
    if (remaining <= 0) kind = "expired";
    else if (remaining <= 1) kind = "urgent";
    else if (remaining <= 3) kind = "soft";
    if (!kind) continue;

    const subs = subsByUser[u.id] || [];
    if (subs.length === 0) continue;

    const title = "みんなの動画";
    const body =
      kind === "expired" ? `${u.name} さん、アクセスが切れました。もう一度サインインを。` :
      kind === "urgent"  ? `${u.name} さん、アクセスが残り 1 日です。` :
                            `${u.name} さん、アクセスが残り 約 ${Math.round(remaining)} 日です。`;
    const url = env.SITE_ORIGIN || "/";

    for (const sub of subs) {
      tasks.push(sendWebPush(env, sub, { title, body, url }, u.id));
    }
  }

  const results = await Promise.allSettled(tasks);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const ng = results.length - ok;
  console.log(`scheduled: sent ${ok}, failed ${ng}`);
}

// =============== Web Push (RFC 8030 + RFC 8291 aes128gcm) ===============

async function sendWebPush(env, subscription, payload, userIdForCleanup) {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await vapidJwt(env, audience);

    const ciphertext = await encryptPushPayload(JSON.stringify(payload), subscription);

    const resp = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
      },
      body: ciphertext,
    });

    if (resp.status === 404 || resp.status === 410) {
      // Subscription gone — clean up
      try {
        await patchPushFile(env, userIdForCleanup, { endpoint: subscription.endpoint }, "remove");
      } catch (e) { console.warn("push cleanup failed:", e.message); }
      return false;
    }
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn(`push ${resp.status}: ${txt.slice(0, 120)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("sendWebPush error:", e.message);
    return false;
  }
}

async function vapidJwt(env, audience) {
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || "mailto:admin@example.com",
  };
  const headerB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;

  const jwk = vapidPrivateJwk(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "jwk", jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(data)
  );
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`;
}

function vapidPrivateJwk(publicKeyB64, privateKeyB64) {
  const pub = b64urlDecodeBytes(publicKeyB64); // 65 bytes: 0x04 || x(32) || y(32)
  const priv = b64urlDecodeBytes(privateKeyB64); // 32 bytes (d)
  return {
    kty: "EC", crv: "P-256",
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: b64urlEncode(priv),
    ext: true,
  };
}

async function encryptPushPayload(plaintextStr, subscription) {
  const recipientPub = b64urlDecodeBytes(subscription.keys.p256dh);
  const recipientAuth = b64urlDecodeBytes(subscription.keys.auth);
  const plaintext = new TextEncoder().encode(plaintextStr);

  // Generate ephemeral keypair (P-256 ECDH)
  const ephem = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveBits"]
  );
  const ephemPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephem.publicKey));

  // Import recipient public key
  const recipientKey = await crypto.subtle.importKey(
    "raw", recipientPub,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  // ECDH
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientKey },
    ephem.privateKey,
    256
  ));

  // PRK_key: HKDF(auth, sharedSecret, "WebPush: info\0" + recipientPub + ephemPub, 32)
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    recipientPub,
    ephemPubRaw,
  );
  const ikm = await hkdfDerive(recipientAuth, sharedSecret, keyInfo, 32);

  // Salt (random 16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK
  const cek = await hkdfDerive(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  // Nonce
  const nonce = await hkdfDerive(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const cekKey = await crypto.subtle.importKey(
    "raw", cek,
    { name: "AES-GCM" },
    false, ["encrypt"]
  );

  // Single record with 0x02 padding terminator (no extra padding)
  const padded = concatBytes(plaintext, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cekKey,
    padded
  ));

  // aes128gcm header: salt(16) + recordSize(4 BE) + idLen(1) + keyId(idLen)
  const header = new Uint8Array(16 + 4 + 1 + ephemPubRaw.length);
  header.set(salt, 0);
  // recordSize 4096 = 0x00 0x00 0x10 0x00
  header[16] = 0x00; header[17] = 0x00; header[18] = 0x10; header[19] = 0x00;
  header[20] = ephemPubRaw.length;
  header.set(ephemPubRaw, 21);

  return concatBytes(header, ciphertext);
}

async function hkdfDerive(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8
  ));
}

function concatBytes(...arrs) {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

function b64urlDecodeBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function patchUsersJson(env, userId, patch, commitMessage) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/users.json?ref=${branch}`;

  const getResp = await fetch(url, { headers: ghHeaders(env) });
  if (!getResp.ok) {
    throw new Error(`get users.json ${getResp.status}: ${await getResp.text()}`);
  }
  const data = await getResp.json();
  const sha = data.sha;
  let users;
  try {
    users = JSON.parse(b64DecodeUtf8(data.content.replace(/\s/g, "")));
  } catch (e) {
    throw new Error("could not parse users.json");
  }
  if (!Array.isArray(users)) throw new Error("users.json is not an array");

  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new Error(`user ${userId} not in users.json`);

  const before = JSON.stringify(users[idx]);
  Object.assign(users[idx], patch);
  if (JSON.stringify(users[idx]) === before) return; // no-op

  const newJson = JSON.stringify(users, null, 2) + "\n";
  const putResp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/users.json`,
    {
      method: "PUT",
      headers: { ...ghHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `chore: ${commitMessage}`,
        content: b64EncodeUtf8(newJson),
        branch,
        sha,
      }),
    }
  );
  if (!putResp.ok) {
    throw new Error(`put users.json ${putResp.status}: ${await putResp.text()}`);
  }
}

function handleLogout(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    ...cors(origin),
    "Content-Type": "application/json",
    "Set-Cookie": clearCookieHeader(),
  };
  return new Response("{}", { status: 200, headers });
}

// ---------------- OAuth helpers ----------------

async function exchangeCode(code, env) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.WORKER_ORIGIN}/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`token exchange ${resp.status}: ${txt.slice(0, 200)}`);
  }
  return resp.json();
}

async function emailFromTokens(tokens) {
  if (tokens.id_token) {
    const parts = tokens.id_token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(b64urlDecodeUtf8(parts[1]));
        if (payload.email) return payload.email;
      } catch {}
    }
  }
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u.email || null;
}

// ---------------- GitHub API ----------------

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "friend-likes-renew",
  };
}

async function updateGithubSecret(env, secretName, value) {
  const keyResp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/secrets/public-key`,
    { headers: ghHeaders(env) }
  );
  if (!keyResp.ok) {
    throw new Error(`fetch public key ${keyResp.status}: ${await keyResp.text()}`);
  }
  const { key, key_id } = await keyResp.json();

  const messageBytes = new TextEncoder().encode(value);
  const recipientPk = b64Decode(key);
  const sealed = sealedBox(messageBytes, recipientPk);
  const encryptedValue = b64Encode(sealed);

  const putResp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/secrets/${secretName}`,
    {
      method: "PUT",
      headers: { ...ghHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ encrypted_value: encryptedValue, key_id }),
    }
  );
  if (!putResp.ok) {
    throw new Error(`put secret ${putResp.status}: ${await putResp.text()}`);
  }
}

async function updateStatusJson(env, userId, tokenIssuedAt) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/status.json?ref=${branch}`;

  let sha = null;
  let current = { users: {}, updatedAt: null };
  const getResp = await fetch(url, { headers: ghHeaders(env) });
  if (getResp.ok) {
    const data = await getResp.json();
    sha = data.sha;
    try {
      current = JSON.parse(b64DecodeUtf8(data.content.replace(/\s/g, ""))) || current;
    } catch {}
  } else if (getResp.status !== 404) {
    throw new Error(`get status.json ${getResp.status}: ${await getResp.text()}`);
  }

  if (!current.users) current.users = {};
  current.users[userId] = { tokenIssuedAt };
  current.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const newJson = JSON.stringify(current, null, 2) + "\n";
  const newContent = b64EncodeUtf8(newJson);

  const body = {
    message: `chore: status.json renew(${userId})`,
    content: newContent,
    branch,
  };
  if (sha) body.sha = sha;

  const putResp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/data/status.json`,
    {
      method: "PUT",
      headers: { ...ghHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!putResp.ok) {
    throw new Error(`put status.json ${putResp.status}: ${await putResp.text()}`);
  }
}

async function triggerWorkflow(env) {
  if (!env.GITHUB_WORKFLOW) return;
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...ghHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: env.GITHUB_BRANCH || "main" }),
    }
  );
  if (!r.ok && r.status !== 204) {
    throw new Error(`dispatch ${r.status}: ${await r.text()}`);
  }
}

// ---------------- Sealed box (libsodium-compatible) ----------------

function sealedBox(messageBytes, recipientPk) {
  const ephem = nacl.box.keyPair();
  const nonceInput = new Uint8Array(64);
  nonceInput.set(ephem.publicKey, 0);
  nonceInput.set(recipientPk, 32);
  const nonce = blake2b(nonceInput, { dkLen: 24 });
  const ct = nacl.box(messageBytes, nonce, recipientPk, ephem.secretKey);
  const out = new Uint8Array(32 + ct.length);
  out.set(ephem.publicKey, 0);
  out.set(ct, 32);
  return out;
}

// ---------------- Cookie + signed tokens ----------------

function readCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

function setCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=None; Max-Age=${COOKIE_TTL_SECONDS}; Path=/`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`;
}

async function signToken(payload, env) {
  const data = b64urlEncodeUtf8(JSON.stringify(payload));
  const sig = await hmacSha256(env.COOKIE_SECRET, data);
  return `${data}.${sig}`;
}

async function verifyToken(token, env) {
  if (!token || typeof token !== "string") return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = await hmacSha256(env.COOKIE_SECRET, data);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(b64urlDecodeUtf8(data));
    if (payload.exp && nowSec() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hmacSha256(secret, data) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

// ---------------- HTML pages ----------------

function successPage(state, userId, name, sessionToken) {
  const data = JSON.stringify({ type: "fls:renewed", userId, name });
  const returnTo = state.returnTo;
  const html = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Done</title>
<style>
  :root { color-scheme: dark; }
  *{box-sizing:border-box}
  body{margin:0;background:#0a0a0a;color:#ededed;font-family:-apple-system,BlinkMacSystemFont,"Inter","Hiragino Sans","Noto Sans JP",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center;-webkit-font-smoothing:antialiased}
  .box{max-width:380px;animation:rise .35s cubic-bezier(.2,.7,.2,1)}
  @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .check{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgba(255,0,0,.06);border:1px solid #ff0000;color:#ff0000;font-size:22px;margin-bottom:18px}
  h1{margin:0 0 8px;font-size:17px;font-weight:600;letter-spacing:-.01em}
  p{margin:0;font-size:13px;color:#8a8a8a;line-height:1.55}
  .small{margin-top:24px;font-size:12px;color:#5a5a5a}
  .small a{color:#ededed}
</style></head>
<body>
  <div class="box">
    <div class="check">✓</div>
    <h1>${escapeHtml(name)} の access を更新しました</h1>
    <p>このウィンドウは自動的に閉じます。</p>
    <p class="small" id="manual" hidden>戻らない場合は <a href="${escapeHtml(returnTo)}">こちら</a></p>
  </div>
<script>
(function(){
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(${data}, ${JSON.stringify(returnTo)});
      setTimeout(function(){ window.close(); }, 500);
    } else {
      var u = new URL(${JSON.stringify(returnTo)});
      u.searchParams.set('renewed', ${JSON.stringify(userId)});
      location.replace(u.toString());
    }
  } catch (e) {
    document.getElementById('manual').hidden = false;
  }
})();
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": setCookieHeader(sessionToken),
      "Cache-Control": "no-store",
    },
  });
}

function errorPage(msg) {
  const html = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error</title>
<style>
  :root { color-scheme: dark; }
  *{box-sizing:border-box}
  body{margin:0;background:#0a0a0a;color:#ededed;font-family:-apple-system,BlinkMacSystemFont,"Inter","Hiragino Sans","Noto Sans JP",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center}
  .box{max-width:480px}
  .x{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgba(255,90,90,.08);border:1px solid #ff5a5a;color:#ff5a5a;font-size:22px;margin-bottom:18px}
  h1{margin:0 0 12px;font-size:17px;font-weight:600;letter-spacing:-.01em}
  p{margin:0;font-size:13px;color:#8a8a8a;line-height:1.55}
  a{color:#ededed}
</style></head>
<body><div class="box">
  <div class="x">!</div>
  <h1>更新できませんでした</h1>
  <p>${msg}</p>
</div></body></html>`;
  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------- Misc utils ----------------

function nowSec() { return Math.floor(Date.now() / 1000); }

function parseJsonSafe(s, fallback) {
  try { return JSON.parse(s || ""); } catch { return fallback; }
}

function sanitizeReturnTo(value, env) {
  if (!value) return env.SITE_ORIGIN;
  try {
    const u = new URL(value);
    const allowed = new URL(env.SITE_ORIGIN);
    if (u.origin !== allowed.origin) return env.SITE_ORIGIN;
    return u.toString();
  } catch {
    return env.SITE_ORIGIN;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function b64Encode(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64Decode(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function b64EncodeUtf8(s) {
  return b64Encode(new TextEncoder().encode(s));
}
function b64DecodeUtf8(s) {
  return new TextDecoder().decode(b64Decode(s));
}
function b64urlEncode(bytes) {
  return b64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlEncodeUtf8(s) {
  return b64urlEncode(new TextEncoder().encode(s));
}
function b64urlDecodeUtf8(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return b64DecodeUtf8(s);
}
