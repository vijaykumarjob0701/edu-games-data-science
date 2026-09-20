export async function getSession() {
  try {
    const res = await fetch("/api/auth", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, ...data };
  } catch {
    return { ok: false, error: "Could not reach the auth service." };
  }
}

export async function unlock(password) {
  const res = await fetch("/api/auth", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok, ...data };
}

export async function lock() {
  await fetch("/api/auth", { method: "DELETE", credentials: "same-origin" });
  location.replace("/gate.html");
}
