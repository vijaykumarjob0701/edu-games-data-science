const COOKIE_NAME = "sl_session";
const SESSION_MESSAGE = "split-lab.session.v1";

function parseCookie(header, name) {
  if (!header) return "";
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === name) return trimmed.slice(eq + 1);
  }
  return "";
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isPublicPath(pathname) {
  if (pathname === "/gate.html" || pathname === "/favicon.svg" || pathname === "/favicon.ico") {
    return true;
  }
  if (pathname === "/api/auth" || pathname === "/.netlify/functions/auth") {
    return true;
  }
  return false;
}

export default async (request, context) => {
  const url = new URL(request.url);
  if (isPublicPath(url.pathname)) {
    return context.next();
  }

  const secret =
    globalThis.Netlify?.env?.get("SITE_PASSWORD") || Deno.env.get("SITE_PASSWORD") || "";
  const presented = parseCookie(request.headers.get("cookie") || "", COOKIE_NAME);
  const expected = secret ? await hmacHex(secret, SESSION_MESSAGE) : "";
  const authed = Boolean(secret && presented && expected && bytesEqual(presented, expected));

  if (authed) {
    if (url.pathname === "/gate.html") {
      return Response.redirect(new URL("/", url), 302);
    }
    return context.next();
  }

  const accept = request.headers.get("accept") || "";
  const wantsHtml =
    request.method === "GET" &&
    (accept.includes("text/html") ||
      url.pathname === "/" ||
      url.pathname === "/index.html" ||
      !url.pathname.includes("."));

  if (wantsHtml) {
    return Response.redirect(new URL("/gate.html", url), 302);
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
};
