import { activate, activatePrime, gradePick, mulberry32, sigmoid, solve } from "../../ml/core.js";
import { blobs, linePoints, outliers, xorPoints } from "../../ml/data2d.js";

export const DATASETS = [
  { id: "blobs", title: "Two blobs", kind: "class", blurb: "Linearly separable classes." },
  { id: "outliers", title: "Blobs + far outliers", kind: "class", blurb: "A few far 0-labels yank unbounded models." },
  { id: "xor", title: "XOR clusters", kind: "class", blurb: "No linear separator exists." },
  { id: "line", title: "A noisy line", kind: "regress", blurb: "Continuous target — a regression job." },
];

export const CHALLENGES = [
  {
    id: "prob-task",
    type: "pick",
    dataset: "blobs",
    title: "You need a probability",
    prompt: "A lender wants P(default = 1) for linearly separable applicants. Which model belongs here?",
    options: [
      { id: "linear", name: "Linear regression", blurb: "Unbounded score, MSE on 0/1 labels." },
      { id: "logistic", name: "Logistic regression", blurb: "Sigmoid probability, log-loss." },
      { id: "perceptron", name: "Perceptron", blurb: "Hard 0/1, no probability." },
    ],
    best: "logistic",
    acceptable: ["perceptron"],
    learned: "Logistic regression squashes a linear score through a sigmoid so outputs stay in (0, 1).",
  },
  {
    id: "ols-binary",
    type: "pick",
    dataset: "outliers",
    title: "OLS on binary labels",
    prompt: "Fit linear regression to 0/1 labels with far outliers. What actually breaks?",
    options: [
      { id: "out_of_range", name: "Predictions leave [0, 1] and outliers yank the plane", blurb: "MSE has no probability semantics." },
      { id: "no_boundary", name: "Linear regression cannot draw a line", blurb: "It always can — that's not the bug." },
      { id: "always_ok", name: "Nothing; MSE is a proper scoring rule for class labels", blurb: "It is not." },
    ],
    best: "out_of_range",
    acceptable: [],
    learned: "Ordinary least squares is unbounded. Outliers yank the plane; ŷ can be 1.7 or −0.4, which are not probabilities.",
  },
  {
    id: "perceptron-xor",
    type: "pick",
    dataset: "xor",
    title: "Perceptron vs XOR",
    prompt: "After many epochs the perceptron is still ~50–70% on XOR. Why?",
    options: [
      { id: "not_separable", name: "XOR is not linearly separable, so the perceptron never converges", blurb: "Convergence needs a separating hyperplane." },
      { id: "lr", name: "The learning rate is always too small on XOR", blurb: "Rate is not the theorem." },
      { id: "labels", name: "XOR labels are continuous, not classes", blurb: "They are 0/1." },
    ],
    best: "not_separable",
    acceptable: [],
    learned: "The perceptron convergence theorem needs a linear separator. XOR has none, so hard updates chatter forever.",
  },
  {
    id: "fit-blobs",
    type: "fit",
    dataset: "blobs",
    model: "logistic",
    title: "Dial in a logistic fit",
    prompt: "Train logistic regression until training accuracy is at least 90% on the blobs.",
    targetAcc: 0.9,
    learned: "Gradient steps on log-loss move the 0.5 contour until the blobs sit on the right side.",
  },
  {
    id: "continuous",
    type: "pick",
    dataset: "line",
    title: "A continuous target",
    prompt: "You must predict a house-price-like number, not a class. Which model is the right tool?",
    options: [
      { id: "linear", name: "Linear regression", blurb: "Fits a plane to a continuous y." },
      { id: "logistic", name: "Logistic regression", blurb: "Outputs a probability in (0, 1)." },
      { id: "perceptron", name: "Perceptron", blurb: "Hard classifier." },
    ],
    best: "linear",
    acceptable: [],
    learned: "Linear regression is the workhorse for a continuous target. Logistic and the perceptron assume labels.",
  },
  {
    id: "soft-vs-hard",
    type: "pick",
    dataset: "blobs",
    title: "Soft vs hard",
    prompt: "On the same blobs, how do the three overlays differ?",
    options: [
      {
        id: "logistic_soft",
        name: "Linear is a plane (unbounded), logistic a sigmoid probability, perceptron a hard cut",
        blurb: "Same linear score, three interpretations.",
      },
      { id: "same", name: "They always produce identical 0/1 labels", blurb: "Thresholded labels can match, the objects do not." },
      { id: "perc_prob", name: "The perceptron is the only one that outputs a calibrated probability", blurb: "Opposite." },
    ],
    best: "logistic_soft",
    acceptable: [],
    learned: "All three use a linear score. Only logistic turns it into a probability; the perceptron thresholds; OLS just fits y.",
  },
];

export function makePoints(datasetId, n = 80, seed = 1) {
  if (datasetId === "outliers") return outliers(n, seed);
  if (datasetId === "xor") return xorPoints(n, seed);
  if (datasetId === "line") return linePoints(n, seed);
  return blobs(n, seed);
}

function model(kind, w) {
  const predict = (x, y) => {
    const z = w[0] + w[1] * x + w[2] * y;
    if (kind === "logistic") return sigmoid(z);
    if (kind === "perceptron") return z >= 0 ? 1 : 0;
    return z;
  };
  return { kind, w, predict };
}

export function fitLinear(points) {
  const xtx = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const xty = [0, 0, 0];
  for (const p of points) {
    const phi = [1, p.x, p.y];
    for (let j = 0; j < 3; j += 1) {
      xty[j] += phi[j] * p.label;
      for (let k = 0; k < 3; k += 1) xtx[j][k] += phi[j] * phi[k];
    }
  }
  for (let j = 0; j < 3; j += 1) xtx[j][j] += 1e-6;
  return model("linear", solve(xtx, xty));
}

export function trainLogistic(points, { lr = 0.3, epochs = 200 } = {}) {
  let w = [0, 0, 0];
  const n = Math.max(1, points.length);
  for (let e = 0; e < epochs; e += 1) {
    const g = [0, 0, 0];
    for (const p of points) {
      const z = w[0] + w[1] * p.x + w[2] * p.y;
      const err = sigmoid(z) - p.label;
      g[0] += err;
      g[1] += err * p.x;
      g[2] += err * p.y;
    }
    w = [w[0] - (lr * g[0]) / n, w[1] - (lr * g[1]) / n, w[2] - (lr * g[2]) / n];
  }
  return model("logistic", w);
}

export function trainPerceptron(points, { lr = 0.2, epochs = 80 } = {}) {
  let w = [0.1, 0.1, 0.1];
  for (let e = 0; e < epochs; e += 1) {
    let mistakes = 0;
    for (const p of points) {
      const z = w[0] + w[1] * p.x + w[2] * p.y;
      const yhat = z >= 0 ? 1 : 0;
      const err = p.label - yhat;
      if (err !== 0) {
        mistakes += 1;
        w = [w[0] + lr * err, w[1] + lr * err * p.x, w[2] + lr * err * p.y];
      }
    }
    if (!mistakes) break;
  }
  return model("perceptron", w);
}

export function trainModel(kind, points, knobs) {
  if (kind === "linear") return fitLinear(points);
  if (kind === "perceptron") return trainPerceptron(points, knobs);
  return trainLogistic(points, knobs);
}

export function predictValue(m, x, y) {
  return m.predict(x, y);
}

export function predictHard(m, x, y) {
  if (m.kind === "perceptron") return m.predict(x, y);
  return m.predict(x, y) >= 0.5 ? 1 : 0;
}

export function accuracy(m, points) {
  if (!points.length) return 0;
  let ok = 0;
  for (const p of points) if (predictHard(m, p.x, p.y) === p.label) ok += 1;
  return ok / points.length;
}

export function decisionGrid(m, { lo = -2.6, hi = 2.6, n = 36 } = {}) {
  const cells = [];
  const step = (hi - lo) / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const x = lo + (j + 0.5) * step;
      const y = lo + (i + 0.5) * step;
      cells.push({ x, y, v: m.predict(x, y) });
    }
  }
  return { cells, lo, hi, n, step };
}

export function isModelQuiz(challenge) {
  if (challenge.type !== "pick" || !challenge.options?.length) return false;
  const ids = new Set(["linear", "logistic", "perceptron"]);
  return challenge.options.every((opt) => ids.has(opt.id));
}

export function resolveAnswer(challenge, { pick = null, model = null } = {}) {
  if (challenge.type === "fit") return null;
  if (pick) return pick;
  if (isModelQuiz(challenge) && model) return model;
  return null;
}

export function gradeChallenge(challenge, answer) {
  if (challenge.type === "fit") {
    const acc = Number(answer);
    if (acc >= challenge.targetAcc) return { points: 3, label: "Locked a clean fit" };
    if (acc >= challenge.targetAcc * 0.85) return { points: 1, label: "Close, keep training" };
    return { points: 0, label: "Accuracy still below the bar" };
  }
  return gradePick(answer, challenge.best, challenge.acceptable || []);
}

export { activate, activatePrime, mulberry32 };
