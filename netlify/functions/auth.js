import {
  clearSessionCookie,
  isSecureRequest,
  makeToken,
  parseCookie,
  serializeSessionCookie,
  tokensMatch,
} from "../lib/session.mjs";

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  const secret = process.env.SITE_PASSWORD || "";
  const method = (event.httpMethod || "GET").toUpperCase();
  const headers = event.headers || {};
  const host = headers.host || headers.Host || "localhost";
  const proto = (headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const url = `${proto}://${host}${event.path || "/api/auth"}`;
  const secure = isSecureRequest(url, headers);
  const cookieHeader = headers.cookie || headers.Cookie || "";
  const presented = parseCookie(cookieHeader);
  const expected = makeToken(secret);

  if (method === "GET") {
    if (!secret) {
      return json(503, {
        ok: false,
        configured: false,
        error: "SITE_PASSWORD is not set on the server.",
      });
    }
    const ok = tokensMatch(presented, expected);
    return json(ok ? 200 : 401, { ok, configured: true });
  }

  if (method === "DELETE") {
    return json(
      200,
      { ok: true },
      { "Set-Cookie": clearSessionCookie({ secure }) },
    );
  }

  if (method === "POST") {
    if (!secret) {
      return json(503, {
        ok: false,
        configured: false,
        error: "SITE_PASSWORD is not set. Add it in Netlify environment variables.",
      });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Send JSON with a password field." });
    }

    const password = typeof payload.password === "string" ? payload.password : "";
    if (!tokensMatch(password, secret)) {
      return json(401, { ok: false, error: "That password does not match." });
    }

    return json(
      200,
      { ok: true },
      { "Set-Cookie": serializeSessionCookie(expected, { secure }) },
    );
  }

  return json(405, { ok: false, error: "Method not allowed." });
}
