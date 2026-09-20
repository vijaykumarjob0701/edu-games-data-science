import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "sl_session";
export const SESSION_MESSAGE = "split-lab.session.v1";
const MAX_AGE = 60 * 60 * 24 * 7;

export function makeToken(secret) {
  if (!secret) return "";
  return createHmac("sha256", secret).update(SESSION_MESSAGE).digest("hex");
}

export function tokensMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseCookie(header, name = COOKIE_NAME) {
  if (!header) return "";
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key === name) return trimmed.slice(eq + 1);
  }
  return "";
}

export function serializeSessionCookie(token, { secure, maxAge = MAX_AGE } = {}) {
  const pieces = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) pieces.push("Secure");
  return pieces.join("; ");
}

export function clearSessionCookie({ secure } = {}) {
  return serializeSessionCookie("", { secure, maxAge: 0 });
}

export function isSecureRequest(url, headers = {}) {
  try {
    if (new URL(url).protocol === "https:") return true;
  } catch {
    /* ignore malformed url */
  }
  const forwarded = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"];
  return String(forwarded || "").split(",")[0].trim() === "https";
}
