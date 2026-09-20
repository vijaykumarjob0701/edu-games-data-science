import { gauss, mulberry32 } from "./core.js";

function push(out, x, y, label) {
  out.push({ x, y, label });
}

export function blobs(n, seed, { noise = 0.28, flip = 0 } = {}) {
  const rng = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const cls = i % 2;
    const cx = cls ? 1.05 : -1.05;
    const cy = cls ? 0.95 : -0.95;
    let label = cls;
    if (flip && rng() < flip) label = 1 - label;
    push(pts, cx + gauss(rng) * noise, cy + gauss(rng) * noise, label);
  }
  return pts;
}

export function xorPoints(n, seed, noise = 0.22) {
  const rng = mulberry32(seed);
  const pts = [];
  const centers = [
    [-1, -1, 0],
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, 0],
  ];
  for (let i = 0; i < n; i += 1) {
    const [cx, cy, label] = centers[i % 4];
    push(pts, cx + gauss(rng) * noise, cy + gauss(rng) * noise, label);
  }
  return pts;
}

export function moons(n, seed, noise = 0.12) {
  const rng = mulberry32(seed);
  const pts = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i += 1) {
    const t = Math.PI * (i / Math.max(1, half - 1));
    push(pts, Math.cos(t) + gauss(rng) * noise, Math.sin(t) + gauss(rng) * noise, 0);
  }
  for (let i = 0; i < n - half; i += 1) {
    const t = Math.PI * (i / Math.max(1, n - half - 1));
    push(pts, 1 - Math.cos(t) + gauss(rng) * noise, 0.35 - Math.sin(t) + gauss(rng) * noise, 1);
  }
  return pts;
}

export function circles(n, seed, noise = 0.08) {
  const rng = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const inner = i % 2 === 0;
    const ang = rng() * Math.PI * 2;
    const r = inner ? 0.45 + gauss(rng) * noise : 1.25 + gauss(rng) * noise;
    push(pts, Math.cos(ang) * r, Math.sin(ang) * r, inner ? 0 : 1);
  }
  return pts;
}

export function outliers(n, seed) {
  const pts = blobs(n - 8, seed, { noise: 0.26 });
  const rng = mulberry32(seed + 17);
  for (let i = 0; i < 8; i += 1) {
    push(pts, 4.6 + gauss(rng) * 0.2, 4.4 + gauss(rng) * 0.2, 0);
  }
  return pts;
}

export function linePoints(n, seed) {
  const rng = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const x = (i / Math.max(1, n - 1)) * 4 - 2;
    const y = gauss(rng) * 0.4;
    const label = 0.25 + 0.55 * x + 0.08 * y + gauss(rng) * 0.08;
    push(pts, x, y, label);
  }
  return pts;
}

export function noisyBlobs(n, seed) {
  return blobs(n, seed, { noise: 0.38, flip: 0.18 });
}
