import { gradePick } from "../../ml/core.js";
import { blobs, noisyBlobs, xorPoints } from "../../ml/data2d.js";

export const DATASETS = [
  { id: "blobs", title: "Two blobs", blurb: "One axis-aligned cut often enough." },
  { id: "xor", title: "XOR clusters", blurb: "Needs more than a stump." },
  { id: "noisy", title: "Noisy blobs", blurb: "Deep trees memorize the flips." },
];

export const CHALLENGES = [
  {
    id: "shallow-blobs",
    dataset: "blobs",
    title: "Beat the stump budget",
    prompt: "Reach ≥ 85% accuracy with depth at most 2. A third split is cheating the budget.",
    targetAcc: 0.85,
    maxDepth: 2,
    learned: "On well-separated blobs, one or two axis-aligned cuts already beat a dummy baseline.",
  },
  {
    id: "xor-depth",
    dataset: "xor",
    title: "XOR needs a second cut",
    prompt: "A stump cannot crack XOR. Grow just deep enough (≥ 2) to clear 85%.",
    targetAcc: 0.85,
    minDepth: 2,
    learned: "Each split is one axis-aligned cut. XOR's checkerboard needs a small tree, not a stump.",
  },
  {
    id: "overfit",
    type: "pick",
    dataset: "noisy",
    title: "Deep vs honest",
    prompt: "Train accuracy is ~100% at depth 8, validation is worse than a depth-2 tree. What happened?",
    options: [
      { id: "overfit", name: "The deep tree memorized label noise — prune or cap depth", blurb: "Classic overfit." },
      { id: "underfit", name: "The deep tree is undercapacity", blurb: "Opposite." },
      { id: "gini", name: "Gini is undefined at depth 8", blurb: "Gini is fine; the data is noisy." },
    ],
    best: "overfit",
    learned: "Leaves with one noisy point are a perfect train score and a worse holdout. Prune.",
  },
  {
    id: "impurity",
    type: "pick",
    dataset: "blobs",
    title: "Read impurity",
    prompt: "A leaf has Gini 0 and entropy 0. What is inside?",
    options: [
      { id: "pure", name: "A pure leaf — every sample shares a label", blurb: "No remaining uncertainty." },
      { id: "empty", name: "The leaf must be empty", blurb: "Empty is undefined / avoided by minLeaf." },
      { id: "fifty", name: "A perfect 50/50 mix", blurb: "That maximizes impurity, not zeros it." },
    ],
    best: "pure",
    learned: "Gini = 1 − Σ p² and entropy = −Σ p log p both hit 0 only when one class has probability 1.",
  },
  {
    id: "criterion",
    type: "pick",
    dataset: "blobs",
    title: "Gini vs entropy",
    prompt: "On these toys, switching Gini ↔ entropy usually…",
    options: [
      { id: "similar", name: "Picks similar splits — both reward purity", blurb: "They are two curves on the same idea." },
      { id: "opposite", name: "Always reverses the tree", blurb: "They rarely disagree on simple 2D toys." },
      { id: "entropy-only", name: "Only entropy can split XOR", blurb: "Both can." },
    ],
    best: "similar",
    learned: "Gini and entropy are different impurities with the same job: score how mixed a node is.",
  },
];

export function makePoints(id, n = 80, seed = 1) {
  if (id === "xor") return xorPoints(n, seed);
  if (id === "noisy") return noisyBlobs(n, seed);
  return blobs(n, seed);
}

export function gini(labels) {
  if (!labels.length) return 0;
  const counts = new Map();
  for (const y of labels) counts.set(y, (counts.get(y) || 0) + 1);
  let s = 1;
  for (const c of counts.values()) {
    const p = c / labels.length;
    s -= p * p;
  }
  return s;
}

export function entropy(labels) {
  if (!labels.length) return 0;
  const counts = new Map();
  for (const y of labels) counts.set(y, (counts.get(y) || 0) + 1);
  let s = 0;
  for (const c of counts.values()) {
    const p = c / labels.length;
    if (p > 0) s -= p * Math.log2(p);
  }
  return s;
}

function impurity(labels, criterion) {
  return criterion === "entropy" ? entropy(labels) : gini(labels);
}

function majority(points) {
  const c = [0, 0];
  for (const p of points) c[p.label] += 1;
  return c[1] >= c[0] ? 1 : 0;
}

export function bestSplit(points, criterion = "gini") {
  const parent = impurity(
    points.map((p) => p.label),
    criterion,
  );
  let best = { feature: "x", threshold: 0, gain: -Infinity, left: [], right: [] };
  for (const feature of ["x", "y"]) {
    const sorted = points.slice().sort((a, b) => a[feature] - b[feature]);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i][feature] === sorted[i - 1][feature]) continue;
      const threshold = (sorted[i][feature] + sorted[i - 1][feature]) / 2;
      const left = sorted.slice(0, i);
      const right = sorted.slice(i);
      if (!left.length || !right.length) continue;
      const n = points.length;
      const gain =
        parent -
        (left.length / n) * impurity(
          left.map((p) => p.label),
          criterion,
        ) -
        (right.length / n) * impurity(
          right.map((p) => p.label),
          criterion,
        );
      if (gain > best.gain) best = { feature, threshold, gain, left, right };
    }
  }
  return best;
}

function leaf(points) {
  return { type: "leaf", label: majority(points), n: points.length, impurity: gini(points.map((p) => p.label)) };
}

export function growTree(points, { maxDepth = 3, minLeaf = 2, criterion = "gini" } = {}, depth = 0) {
  const labels = points.map((p) => p.label);
  const pure = labels.every((y) => y === labels[0]);
  if (pure || depth >= maxDepth || points.length < minLeaf * 2) return leaf(points);
  const split = bestSplit(points, criterion);
  if (!split.left.length || !split.right.length || split.gain <= 1e-12) return leaf(points);
  if (split.left.length < minLeaf || split.right.length < minLeaf) return leaf(points);
  return {
    type: "node",
    feature: split.feature,
    threshold: split.threshold,
    gain: split.gain,
    left: growTree(split.left, { maxDepth, minLeaf, criterion }, depth + 1),
    right: growTree(split.right, { maxDepth, minLeaf, criterion }, depth + 1),
    n: points.length,
  };
}

export function treeDepth(node) {
  if (!node || node.type === "leaf") return 0;
  return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}

export function predictTree(node, point) {
  if (node.type === "leaf") return node.label;
  if (point[node.feature] <= node.threshold) return predictTree(node.left, point);
  return predictTree(node.right, point);
}

export function treeAccuracy(node, points) {
  if (!points.length) return 0;
  let ok = 0;
  for (const p of points) if (predictTree(node, p) === p.label) ok += 1;
  return ok / points.length;
}

export function applyManualSplit(points, feature, threshold) {
  const left = points.filter((p) => p[feature] <= threshold);
  const right = points.filter((p) => p[feature] > threshold);
  return {
    type: "node",
    feature,
    threshold,
    left: leaf(left.length ? left : points),
    right: leaf(right.length ? right : points),
    n: points.length,
    gain:
      gini(points.map((p) => p.label)) -
      (left.length / points.length) * gini(left.map((p) => p.label)) -
      (right.length / points.length) * gini(right.map((p) => p.label)),
  };
}

export function partitions(node, bounds = { x0: -2.6, x1: 2.6, y0: -2.6, y1: 2.6 }, acc = []) {
  if (!node) return acc;
  if (node.type === "leaf") {
    acc.push({ ...bounds, label: node.label });
    return acc;
  }
  if (node.feature === "x") {
    partitions(node.left, { ...bounds, x1: Math.min(bounds.x1, node.threshold) }, acc);
    partitions(node.right, { ...bounds, x0: Math.max(bounds.x0, node.threshold) }, acc);
  } else {
    partitions(node.left, { ...bounds, y1: Math.min(bounds.y1, node.threshold) }, acc);
    partitions(node.right, { ...bounds, y0: Math.max(bounds.y0, node.threshold) }, acc);
  }
  return acc;
}

export function gradeTree(challenge, answer) {
  if (challenge.type === "pick") {
    const choice = typeof answer === "string" ? answer : answer?.choice;
    return gradePick(choice, challenge.best, challenge.acceptable || []);
  }
  const depth = answer.depth ?? 0;
  const acc = answer.acc ?? 0;
  if (challenge.maxDepth != null && depth > challenge.maxDepth) {
    return { points: 0, label: "Too deep for this budget — prune it" };
  }
  if (challenge.minDepth != null && depth < challenge.minDepth) {
    return { points: 0, label: "A stump cannot cut XOR — grow one more split" };
  }
  if (acc >= challenge.targetAcc) return { points: 3, label: "Beats the baseline" };
  if (acc >= challenge.targetAcc * 0.8) return { points: 1, label: "Close — try a better cut" };
  return { points: 0, label: "Accuracy still below the bar" };
}
