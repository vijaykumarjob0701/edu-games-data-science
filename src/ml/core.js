export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sigmoid(z) {
  if (z >= 20) return 1;
  if (z <= -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function tanh(z) {
  return Math.tanh(z);
}

export function relu(z) {
  return z > 0 ? z : 0;
}

export function activate(name, z) {
  if (name === "relu") return relu(z);
  if (name === "tanh") return tanh(z);
  if (name === "linear") return z;
  return sigmoid(z);
}

export function activatePrime(name, z) {
  if (name === "relu") return z > 0 ? 1 : 0;
  if (name === "tanh") {
    const t = Math.tanh(z);
    return 1 - t * t;
  }
  if (name === "linear") return 1;
  const s = sigmoid(z);
  return s * (1 - s);
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat(b[i]));
  for (let i = 0; i < n; i += 1) {
    let max = i;
    for (let r = i + 1; r < n; r += 1) if (Math.abs(M[r][i]) > Math.abs(M[max][i])) max = r;
    [M[i], M[max]] = [M[max], M[i]];
    const pivot = M[i][i] || 1e-12;
    for (let c = i; c <= n; c += 1) M[i][c] /= pivot;
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const f = M[r][i];
      for (let c = i; c <= n; c += 1) M[r][c] -= f * M[i][c];
    }
  }
  return M.map((row) => row[n]);
}

export function gradePick(choice, best, acceptable = []) {
  if (choice === best) return { tier: "best", points: 3, label: "Best pick" };
  if (acceptable.includes(choice)) return { tier: "ok", points: 1, label: "Acceptable, not ideal" };
  return { tier: "miss", points: 0, label: "Not the lesson" };
}

export function splitXY(points, seed = 1, frac = 0.7) {
  const rng = mulberry32(seed);
  const shuffled = points.slice().sort(() => rng() - 0.5);
  const n = Math.max(1, Math.floor(shuffled.length * frac));
  return { train: shuffled.slice(0, n), val: shuffled.slice(n) };
}
