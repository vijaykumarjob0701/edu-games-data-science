import { activate, activatePrime, mulberry32, sigmoid } from "../../ml/core.js";
import { circles, moons, xorPoints } from "../../ml/data2d.js";

export const DATASETS = [
  { id: "xor", title: "XOR clusters", blurb: "Needs a nonlinear hidden layer." },
  { id: "moons", title: "Two moons", blurb: "A curved decision surface." },
  { id: "circles", title: "Concentric circles", blurb: "Radial pattern, linear nets fail." },
];

export const CHALLENGES = [
  {
    id: "xor",
    dataset: "xor",
    title: "Crack XOR",
    prompt: "Build a net that reaches ≥ 85% accuracy. A linear (no-hidden) model cannot.",
    targetAcc: 0.85,
    requireHidden: true,
    learned: "XOR is not linearly separable. One nonlinear hidden layer with enough width folds the space.",
  },
  {
    id: "circles",
    dataset: "circles",
    title: "Nest the circles",
    prompt: "Separate inner vs outer rings at ≥ 85% accuracy.",
    targetAcc: 0.85,
    requireHidden: true,
    learned: "A linear score is a half-plane. Circles need a curved, nonlinear surface.",
  },
  {
    id: "moons",
    dataset: "moons",
    title: "Unhook the moons",
    prompt: "Fit the two interlocking moons at ≥ 88% accuracy.",
    targetAcc: 0.88,
    requireHidden: true,
    learned: "Capacity (width × depth) plus a nonlinearity is what bends the 0.5 contour around the crescent.",
  },
  {
    id: "linear-act",
    type: "pick",
    dataset: "xor",
    title: "Linear activations collapse",
    prompt: "What happens if every hidden layer uses a linear activation?",
    options: [
      { id: "collapse", name: "The whole net is still one linear map — XOR stays unsolved", blurb: "Composition of linear maps is linear." },
      { id: "deeper", name: "More linear layers always beat a perceptron on XOR", blurb: "Depth without nonlinearity adds no new functions." },
      { id: "relu-only", name: "Only ReLU can represent XOR; tanh cannot", blurb: "Any nonlinearity can, given width." },
    ],
    best: "collapse",
    learned: "Stacking linear layers is still a linear classifier. The S-curve / hinge is the whole trick.",
  },
];

export function makePoints(id, n = 80, seed = 1) {
  if (id === "moons") return moons(n, seed);
  if (id === "circles") return circles(n, seed);
  return xorPoints(n, seed);
}

function randn(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function initNet({ hidden = 1, width = 4, activation = "relu", seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const sizes = [2];
  for (let i = 0; i < hidden; i += 1) sizes.push(width);
  sizes.push(1);
  const layers = [];
  for (let i = 0; i < sizes.length - 1; i += 1) {
    const inn = sizes[i];
    const out = sizes[i + 1];
    const last = i === sizes.length - 2;
    const act = last ? "sigmoid" : activation;
    const scale = act === "relu" ? Math.sqrt(2 / inn) : Math.sqrt(1 / inn);
    const W = Array.from({ length: out }, () => Array.from({ length: inn }, () => randn(rng) * scale));
    const b = Array.from({ length: out }, () => (act === "relu" ? 0.08 : 0));
    layers.push({ W, b, act });
  }
  return { layers, hidden, width, activation };
}

function forward(net, x) {
  let a = x;
  const as = [a];
  const zs = [];
  for (const layer of net.layers) {
    const z = layer.W.map((row, j) => {
      let s = layer.b[j];
      for (let k = 0; k < row.length; k += 1) s += row[k] * a[k];
      return s;
    });
    zs.push(z);
    a = z.map((v) => activate(layer.act, v));
    as.push(a);
  }
  return { as, zs, output: a[0] };
}

function backward(net, x, y) {
  const { as, zs } = forward(net, x);
  let delta = [as.at(-1)[0] - y];
  const dW = Array(net.layers.length);
  const db = Array(net.layers.length);
  for (let li = net.layers.length - 1; li >= 0; li -= 1) {
    const layer = net.layers[li];
    const aPrev = as[li];
    dW[li] = delta.map((d) => aPrev.map((ap) => d * ap));
    db[li] = delta.slice();
    if (li === 0) break;
    const prev = net.layers[li - 1];
    const zPrev = zs[li - 1];
    const next = [];
    for (let k = 0; k < prev.W.length; k += 1) {
      let s = 0;
      for (let j = 0; j < delta.length; j += 1) s += layer.W[j][k] * delta[j];
      next.push(s * activatePrime(prev.act, zPrev[k]));
    }
    delta = next;
  }
  return { dW, db, output: as.at(-1)[0] };
}

export function trainNet(net, points, { lr = 0.3, epochs = 200 } = {}) {
  const rng = mulberry32(11);
  for (let e = 0; e < epochs; e += 1) {
    const order = points.map((_, i) => i).sort(() => rng() - 0.5);
    for (const i of order) {
      const p = points[i];
      const g = backward(net, [p.x, p.y], p.label);
      for (let li = 0; li < net.layers.length; li += 1) {
        const layer = net.layers[li];
        for (let j = 0; j < layer.W.length; j += 1) {
          layer.b[j] -= lr * g.db[li][j];
          for (let k = 0; k < layer.W[j].length; k += 1) layer.W[j][k] -= lr * g.dW[li][j][k];
        }
      }
    }
  }
  return net;
}

export function predict(net, x, y) {
  return forward(net, [x, y]).output;
}

export function mlpAccuracy(net, points) {
  if (!points.length) return 0;
  let ok = 0;
  for (const p of points) if ((predict(net, p.x, p.y) >= 0.5 ? 1 : 0) === p.label) ok += 1;
  return ok / points.length;
}

export function forwardActivations(net, x, y) {
  const { as, zs, output } = forward(net, [x, y]);
  return {
    output,
    layers: as.map((a, i) => ({
      a,
      z: i === 0 ? a : zs[i - 1],
      name: i === 0 ? "input" : i === as.length - 1 ? "output" : `hidden ${i}`,
    })),
  };
}

export function decisionGrid(net, { lo = -2.4, hi = 2.4, n = 32 } = {}) {
  const cells = [];
  const step = (hi - lo) / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const x = lo + (j + 0.5) * step;
      const y = lo + (i + 0.5) * step;
      cells.push({ x, y, v: predict(net, x, y) });
    }
  }
  return { cells, lo, hi, n, step };
}

export function gradeMlpChallenge(challenge, answer) {
  if (challenge.type === "pick") {
    if (answer === challenge.best || answer?.choice === challenge.best) {
      return { points: 3, label: "Best pick" };
    }
    return { points: 0, label: "Not the lesson" };
  }
  const hidden = answer.hidden ?? 0;
  const acc = answer.acc ?? 0;
  if (challenge.requireHidden && hidden < 1) return { points: 0, label: "A linear net cannot bend XOR / rings / moons" };
  if (challenge.activation && answer.activation === "linear") {
    return { points: 0, label: "Linear hidden units collapse to a perceptron" };
  }
  if (acc >= challenge.targetAcc) return { points: 3, label: "Surface looks right" };
  if (acc >= challenge.targetAcc * 0.8) return { points: 1, label: "Getting there — train longer or widen" };
  return { points: 0, label: "Accuracy still below the bar" };
}

export { sigmoid };
