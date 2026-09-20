function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ARENAS = [
  {
    id: "gentle-line",
    title: "Almost a line",
    blurb: "n is decent, noise is low, truth is nearly linear. Extra capacity mostly memorizes jitter.",
    nTrain: 80,
    nVal: 80,
    noise: 0.12,
    kind: "linear",
    seed: 7,
    targetVal: 0.08,
  },
  {
    id: "wiggle",
    title: "A real wiggle",
    blurb: "The truth is a sine. Too little capacity underfits; too much still overfits the noise.",
    nTrain: 90,
    nVal: 90,
    noise: 0.18,
    kind: "sine",
    seed: 21,
    targetVal: 0.12,
  },
  {
    id: "tiny-noisy",
    title: "Tiny and loud",
    blurb: "30 training points, lots of noise. Regularization is the whole game.",
    nTrain: 30,
    nVal: 80,
    noise: 0.45,
    kind: "sine",
    seed: 99,
    targetVal: 0.35,
  },
  {
    id: "step",
    title: "A hidden jump",
    blurb: "Truth is piecewise. A stump is too dumb; a degree-11 polynomial will ring.",
    nTrain: 70,
    nVal: 70,
    noise: 0.16,
    kind: "step",
    seed: 3,
    targetVal: 0.14,
  },
  {
    id: "more-data",
    title: "Capacity meets sample size",
    blurb: "Same wiggle as before, but 220 train rows. You can afford more capacity now.",
    nTrain: 220,
    nVal: 100,
    noise: 0.18,
    kind: "sine",
    seed: 21,
    targetVal: 0.1,
  },
  {
    id: "early-stop",
    title: "Stop before the gap opens",
    blurb: "Watch train vs val as capacity climbs. Lock the degree where val is still falling.",
    nTrain: 60,
    nVal: 60,
    noise: 0.22,
    kind: "sine",
    seed: 44,
    targetVal: 0.16,
  },
];

export function truth(kind, x) {
  if (kind === "linear") return 0.35 + 1.1 * x;
  if (kind === "step") return x < 0.55 ? 0.25 : 1.15;
  return 0.5 + 0.45 * Math.sin(2.2 * Math.PI * x);
}

export function makeSplit(arena) {
  const rng = mulberry32(arena.seed);
  const make = (n) => {
    const x = [];
    const y = [];
    for (let i = 0; i < n; i += 1) {
      const xi = rng();
      const yi = truth(arena.kind, xi) + (rng() * 2 - 1) * arena.noise;
      x.push(xi);
      y.push(yi);
    }
    return { x, y };
  };
  return { train: make(arena.nTrain), val: make(arena.nVal) };
}

function solve(A, b) {
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

export function fitRidgePoly(x, y, degree, lambda) {
  const p = degree + 1;
  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  for (let i = 0; i < x.length; i += 1) {
    const phi = [];
    let v = 1;
    for (let j = 0; j < p; j += 1) {
      phi.push(v);
      v *= x[i];
    }
    for (let j = 0; j < p; j += 1) {
      xty[j] += phi[j] * y[i];
      for (let k = 0; k < p; k += 1) xtx[j][k] += phi[j] * phi[k];
    }
  }
  for (let j = 0; j < p; j += 1) xtx[j][j] += lambda;
  const beta = solve(xtx, xty);
  const predict = (z) => {
    let s = 0;
    let v = 1;
    for (let j = 0; j < p; j += 1) {
      s += beta[j] * v;
      v *= z;
    }
    return s;
  };
  return { beta, predict };
}

export function mse(x, y, predict) {
  if (!x.length) return Infinity;
  let s = 0;
  for (let i = 0; i < x.length; i += 1) {
    const e = y[i] - predict(x[i]);
    s += e * e;
  }
  return s / x.length;
}

export function evaluate(arena, degree, lambda, split = makeSplit(arena)) {
  const model = fitRidgePoly(split.train.x, split.train.y, degree, lambda);
  const trainMse = mse(split.train.x, split.train.y, model.predict);
  const valMse = mse(split.val.x, split.val.y, model.predict);
  return { ...split, predict: model.predict, trainMse, valMse, gap: valMse - trainMse };
}

export function curve(predict, steps = 80) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = i / steps;
    pts.push([x, predict(x)]);
  }
  return pts;
}

export function gradeArena(valMse, targetVal) {
  if (valMse <= targetVal) return { points: 3, label: "Generalizes" };
  if (valMse <= targetVal * 1.45) return { points: 2, label: "Close" };
  if (valMse <= targetVal * 2.1) return { points: 1, label: "Under-regularized or underfit" };
  return { points: 0, label: "The holdout did not agree" };
}
