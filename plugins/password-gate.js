import {
  clearSessionCookie,
  makeToken,
  parseCookie,
  serializeSessionCookie,
  tokensMatch,
} from "../netlify/lib/session.mjs";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 8192) {
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.end(payload);
}

async function handleAuth(req, res, secret) {
  const method = (req.method || "GET").toUpperCase();
  const protoHeader = req.headers["x-forwarded-proto"] || "http";
  const secure = String(protoHeader).split(",")[0].trim() === "https";
  const presented = parseCookie(req.headers.cookie || "");
  const expected = makeToken(secret);

  if (method === "GET") {
    if (!secret) {
      sendJson(res, 503, {
        ok: false,
        configured: false,
        error: "SITE_PASSWORD is not set. Copy .env.example to .env and set it.",
      });
      return;
    }
    const ok = tokensMatch(presented, expected);
    sendJson(res, ok ? 200 : 401, { ok, configured: true });
    return;
  }

  if (method === "DELETE") {
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie({ secure }) });
    return;
  }

  if (method === "POST") {
    if (!secret) {
      sendJson(res, 503, {
        ok: false,
        configured: false,
        error: "SITE_PASSWORD is not set. Copy .env.example to .env and set it.",
      });
      return;
    }
    let payload = {};
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { ok: false, error: "Send JSON with a password field." });
      return;
    }
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!tokensMatch(password, secret)) {
      sendJson(res, 401, { ok: false, error: "That password does not match." });
      return;
    }
    sendJson(
      res,
      200,
      { ok: true },
      { "Set-Cookie": serializeSessionCookie(expected, { secure }) },
    );
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed." });
}

function isPublicPath(urlPath) {
  return (
    urlPath === "/gate.html" ||
    urlPath === "/favicon.svg" ||
    urlPath === "/favicon.ico" ||
    urlPath.startsWith("/api/auth")
  );
}

function attach(server, secret) {
  server.middlewares.use(async (req, res, next) => {
    const urlPath = (req.url || "/").split("?")[0];
    if (urlPath === "/api/auth" || urlPath.startsWith("/api/auth")) {
      try {
        await handleAuth(req, res, secret);
      } catch {
        sendJson(res, 500, { ok: false, error: "Auth handler failed." });
      }
      return;
    }

    const presented = parseCookie(req.headers.cookie || "");
    const expected = makeToken(secret);
    const authed = Boolean(secret && tokensMatch(presented, expected));
    if (authed || isPublicPath(urlPath)) {
      next();
      return;
    }

    const accept = req.headers.accept || "";
    const wantsHtml =
      req.method === "GET" &&
      (accept.includes("text/html") ||
        urlPath === "/" ||
        urlPath === "/index.html" ||
        urlPath === "");

    if (wantsHtml) {
      res.statusCode = 302;
      res.setHeader("Location", "/gate.html");
      res.end();
      return;
    }

    next();
  });
}

export function passwordGatePlugin(secret) {
  return {
    name: "password-gate",
    configureServer(server) {
      attach(server, secret);
    },
    configurePreviewServer(server) {
      attach(server, secret);
    },
  };
}
