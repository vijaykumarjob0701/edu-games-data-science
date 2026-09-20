import { activate, activatePrime, gradePick, mulberry32 } from "../../ml/core.js";

function layer(W, b, act) {
  return { W: W.map((row) => row.slice()), b: b.slice(), act };
}

export function demoNet() {
  return {
    layers: [
      layer(
        [
          [0.45, -0.25],
          [0.3, 0.55],
        ],
        [0.1, -0.15],
        "sigmoid",
      ),
      layer([[0.6, -0.35]], [0.05], "sigmoid"),
    ],
  };
}

function cloneNet(net) {
  return { layers: net.layers.map((l) => layer(l.W, l.b, l.act)) };
}

function forward(net, x) {
  let a = x.slice();
  const activations = [a.slice()];
  const zs = [];
  for (const lyr of net.layers) {
    const z = lyr.W.map((row, j) => {
      let s = lyr.b[j];
      for (let k = 0; k < row.length; k += 1) s += row[k] * a[k];
      return s;
    });
    zs.push(z);
    a = z.map((v) => activate(lyr.act, v));
    activations.push(a.slice());
  }
  const output = a[0];
  const loss = (y) => {
    const p = Math.min(1 - 1e-7, Math.max(1e-7, output));
    return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  };
  return { activations, zs, output, loss };
}

export function forwardPass(net, x) {
  return forward(net, x);
}

export function backwardPass(net, x, y) {
  const { activations, zs, output } = forward(net, x);
  let delta = [output - y];
  const dW = Array(net.layers.length);
  const db = Array(net.layers.length);
  for (let li = net.layers.length - 1; li >= 0; li -= 1) {
    const lyr = net.layers[li];
    const aPrev = activations[li];
    dW[li] = delta.map((d) => aPrev.map((ap) => d * ap));
    db[li] = delta.slice();
    if (li === 0) break;
    const prev = net.layers[li - 1];
    const zPrev = zs[li - 1];
    const nxt = [];
    for (let k = 0; k < prev.W.length; k += 1) {
      let s = 0;
      for (let j = 0; j < delta.length; j += 1) s += lyr.W[j][k] * delta[j];
      nxt.push(s * activatePrime(prev.act, zPrev[k]));
    }
    delta = nxt;
  }
  return { dW, db, output };
}

export function applyUpdate(net, grads, lr) {
  for (let li = 0; li < net.layers.length; li += 1) {
    const lyr = net.layers[li];
    for (let j = 0; j < lyr.W.length; j += 1) {
      lyr.b[j] -= lr * grads.db[li][j];
      for (let k = 0; k < lyr.W[j].length; k += 1) lyr.W[j][k] -= lr * grads.dW[li][j][k];
    }
  }
  return net;
}

function frobenius(mat) {
  let s = 0;
  for (const row of mat) for (const v of row) s += v * v;
  return Math.sqrt(s);
}

export function layerGradNorms({ depth = 5, width = 2, act = "sigmoid", scale = 0.25, seed = 2 } = {}) {
  const rng = mulberry32(seed);
  const sizes = Array.from({ length: depth + 1 }, (_, i) => (i === 0 || i === depth ? (i === 0 ? 2 : 1) : width));
  const layers = [];
  for (let i = 0; i < sizes.length - 1; i += 1) {
    const inn = sizes[i];
    const out = sizes[i + 1];
    const W = Array.from({ length: out }, () => Array.from({ length: inn }, () => (rng() * 2 - 1) * scale));
    const b = Array(out).fill(0);
    layers.push({ W, b, act: i === sizes.length - 2 ? "sigmoid" : act });
  }
  const net = { layers };
  const g = backwardPass(net, [0.7, -0.2], 1);
  return g.dW.map((mat) => frobenius(mat));
}

function largestWeight(net, grads) {
  let best = { layer: 0, i: 0, j: 0, mag: -1 };
  for (let li = 0; li < grads.dW.length; li += 1) {
    for (let i = 0; i < grads.dW[li].length; i += 1) {
      for (let j = 0; j < grads.dW[li][i].length; j += 1) {
        const mag = Math.abs(grads.dW[li][i][j]);
        if (mag > best.mag) best = { layer: li, i, j, mag };
      }
    }
  }
  return best;
}

const DEMO_X = [0.8, -0.4];
const DEMO_Y = 1;

function biggerUpdateAnswer() {
  const net = demoNet();
  const g = backwardPass(net, DEMO_X, DEMO_Y);
  const best = largestWeight(net, g);
  return `L${best.layer + 1} w[${best.i},${best.j}]`;
}

export const QUIZZES = [
  {
    id: "bigger-update",
    title: "Which weight moves more?",
    prompt: `Forward x = [${DEMO_X.join(", ")}], target y = ${DEMO_Y} on the 2→2→1 demo net. Which weight has the largest |∂L/∂w|?`,
    best: biggerUpdateAnswer(),
    options: () => {
      const net = demoNet();
      const names = [];
      for (let li = 0; li < net.layers.length; li += 1) {
        for (let i = 0; i < net.layers[li].W.length; i += 1) {
          for (let j = 0; j < net.layers[li].W[i].length; j += 1) {
            names.push(`L${li + 1} w[${i},${j}]`);
          }
        }
      }
      return names;
    },
    learned: "The gradient w.r.t. a weight is (upstream delta) × (incoming activation). Large activation × large delta wins.",
  },
  {
    id: "vanish",
    type: "pick",
    title: "Vanishing gradient",
    prompt: "A 5-layer sigmoid net with small weights: |grad| at the first layer is a fraction of the last. What is going on?",
    options: [
      { id: "vanish", name: "Vanishing gradients — each sigmoid derivative ≤ 0.25 multiplies the signal away", blurb: "Early weights barely move." },
      { id: "explode", name: "Exploding gradients — small weights always blow up", blurb: "Small weights shrink, they do not explode." },
      { id: "lr", name: "The learning rate is the only possible cause", blurb: "η scales the update, not the relative layer norms." },
    ],
    best: "vanish",
    learned: "σ′(z) ≤ 1/4. Chain five of those with |w| < 1 and the first layer's gradient evaporates.",
  },
  {
    id: "forward-guess",
    type: "pick",
    title: "Read the forward pass",
    prompt: "After the forward pass on the demo net with x = [0.5, −0.2], is the output above or below 0.5?",
    options: [
      { id: "above", name: "Above 0.5 (leaning class 1)" },
      { id: "below", name: "Below 0.5 (leaning class 0)" },
    ],
    best: forwardPass(demoNet(), [0.5, -0.2]).output >= 0.5 ? "above" : "below",
    learned: "The forward pass is just affine → activation, stacked. The number you see is already the model's current belief.",
  },
  {
    id: "loss-drop",
    type: "pick",
    title: "One update",
    prompt: "After one gradient step with a moderate η on this labeled example, what should happen to the loss?",
    options: [
      { id: "down", name: "It should drop — we stepped opposite the gradient", blurb: "Locally, −η∇L decreases L." },
      { id: "up", name: "It must rise because sigmoid saturates", blurb: "Saturation slows steps; it does not invert them." },
      { id: "same", name: "Loss is invariant to weight updates", blurb: "Then we would not train." },
    ],
    best: "down",
    learned: "Gradient descent is locally the direction of steepest decrease. A sane η lowers this example's loss.",
  },
  {
    id: "delta-flow",
    type: "pick",
    title: "How the error flows",
    prompt: "During backprop, the output delta (a − y) is multiplied by each incoming activation to get ∂L/∂w. If an activation is ~0, that weight's update is…",
    options: [
      { id: "tiny", name: "Tiny — dead / off units do not train", blurb: "δ · a ≈ 0." },
      { id: "huge", name: "Huge — zeros explode the chain rule", blurb: "Zero kills the product." },
      { id: "bias", name: "Equal to the bias gradient only", blurb: "Bias ignores a, weights do not." },
    ],
    best: "tiny",
    learned: "∂L/∂w_ij = δ_i a_j. No activation, no credit. That is why ReLU can 'die' and why we watch activations.",
  },
];

export function gradeBackprop(quiz, answer) {
  const best = typeof quiz.best === "function" ? quiz.best() : quiz.best;
  const choice = typeof answer === "string" ? answer : answer?.choice;
  return gradePick(choice, best, quiz.acceptable || []);
}

export function framesFor(net, x, y) {
  const fwd = forwardPass(net, x);
  const back = backwardPass(net, x, y);
  const frames = [];
  frames.push({ kind: "input", title: "Input", detail: `x = [${x.map((v) => v.toFixed(2)).join(", ")}]` });
  fwd.activations.forEach((a, i) => {
    if (i === 0) return;
    const name = i === fwd.activations.length - 1 ? "output" : `hidden ${i}`;
    frames.push({
      kind: "forward",
      title: `Forward · ${name}`,
      detail: `a = [${a.map((v) => v.toFixed(3)).join(", ")}]`,
      activations: a,
    });
  });
  frames.push({
    kind: "loss",
    title: "Loss",
    detail: `L = ${fwd.loss(y).toFixed(4)}  (target y = ${y}, ŷ = ${fwd.output.toFixed(3)})`,
  });
  back.dW.forEach((mat, li) => {
    frames.push({
      kind: "backward",
      title: `Backward · layer ${li + 1} weights`,
      detail: mat.map((row) => row.map((v) => v.toFixed(3)).join(", ")).join(" | "),
      dW: mat,
      db: back.db[li],
    });
  });
  return { frames, fwd, back };
}

export { cloneNet };
