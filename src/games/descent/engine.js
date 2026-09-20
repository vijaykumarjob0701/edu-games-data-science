export const SURFACES = {
  bowl: {
    id: "bowl",
    title: "Nice bowl",
    blurb: "f = x² + 2y². Well-conditioned; a moderate rate just works.",
    start: { x: 1.2, y: 0.9 },
    f: (x, y) => x * x + 2 * y * y,
    grad: (x, y) => ({ x: 2 * x, y: 4 * y }),
    bounds: { lo: -2.2, hi: 2.2 },
  },
  valley: {
    id: "valley",
    title: "Narrow valley",
    blurb: "f = 0.08x² + 5y². Tiny y-steps explode unless the rate is small or you add momentum.",
    start: { x: 1.4, y: 0.55 },
    f: (x, y) => 0.08 * x * x + 5 * y * y,
    grad: (x, y) => ({ x: 0.16 * x, y: 10 * y }),
    bounds: { lo: -2.4, hi: 2.4 },
  },
  banana: {
    id: "banana",
    title: "Bent banana",
    blurb: "A Rosenbrock-style valley. Too-large steps jump the canyon; too-small steps crawl the floor.",
    start: { x: -0.6, y: 0.8 },
    f: (x, y) => (1 - x) ** 2 + 40 * (y - x * x) ** 2,
    grad: (x, y) => {
      const d = y - x * x;
      return { x: -2 * (1 - x) - 160 * d * x, y: 80 * d };
    },
    bounds: { lo: -2.2, hi: 2.2 },
  },
};

export const CHALLENGES = [
  {
    id: "bowl-race",
    surface: "bowl",
    title: "Reach the floor",
    prompt: "On the bowl, get loss below 0.05 in at most 50 steps. Moderate learning rate; no need for momentum.",
    targetLoss: 0.05,
    maxSteps: 50,
    learned: "A well-conditioned bowl is a textbook (1 − ηλ) contraction. Too big η flips the sign and explodes.",
  },
  {
    id: "too-high",
    type: "pick",
    surface: "bowl",
    title: "When steps explode",
    prompt: "You set η = 2.4 on x² + 2y². What happens to the iterates?",
    options: [
      { id: "diverged", name: "They diverge — each step overshoots and grows", blurb: "|1 − ηλ| > 1." },
      { id: "crawling", name: "They crawl toward zero, just slowly", blurb: "That is a tiny η." },
      { id: "converged", name: "They still converge, because bowls are convex", blurb: "Convexity is not a free pass on step size." },
    ],
    best: "diverged",
    learned: "For a quadratic, the update is x ← (1 − ηλ)x. If |1 − ηλ| > 1 the sequence explodes. That is exploding step size, not vanishing gradients.",
  },
  {
    id: "too-low",
    type: "pick",
    surface: "bowl",
    title: "When steps vanish",
    prompt: "η = 0.002 for 25 steps from (1.2, 0.9). What is the honest diagnosis?",
    options: [
      { id: "crawling", name: "Crawling — each step is a tiny fraction of the remaining error", blurb: "Vanishing step size from a timid η." },
      { id: "diverged", name: "Diverged — loss is already infinite", blurb: "Tiny η is stable, just slow." },
      { id: "momentum", name: "Only momentum can move on a convex bowl", blurb: "Plain GD works; it is just slow." },
    ],
    best: "crawling",
    learned: "Vanishing step size here is not a sigmoid derivative — it is η‖∇f‖ being tiny. Same symptom, different cause.",
  },
  {
    id: "valley-run",
    surface: "valley",
    title: "Survive the ravine",
    prompt: "On the narrow valley, reach loss < 0.08 in 80 steps. A little momentum usually helps.",
    targetLoss: 0.08,
    maxSteps: 80,
    learned: "Ill-conditioned bowls need small η on the sharp axis. Momentum averages gradients so you can keep moving along the long floor.",
  },
  {
    id: "step-size",
    type: "pick",
    surface: "banana",
    title: "Name the failure",
    prompt: "Loss blows up: exploding step size. Loss barely budges: vanishing step size. Which knob is the first to check?",
    options: [
      { id: "lr", name: "Learning rate (and maybe momentum) relative to curvature", blurb: "η × Hessian eigenvalues." },
      { id: "width", name: "Hidden-layer width of the optimizer", blurb: "GD has no hidden layer." },
      { id: "labels", name: "Whether the labels are 0/1", blurb: "This playground is an unlabeled surface." },
    ],
    best: "lr",
    learned: "Step length ≈ η‖∇f‖. Huge η explodes; tiny η crawls. Momentum rescales that story on ravines.",
  },
];

export function runDescent(surfaceId, { lr = 0.1, momentum = 0, steps = 40, start } = {}) {
  const surface = SURFACES[surfaceId];
  const s0 = start || surface.start;
  let x = s0.x;
  let y = s0.y;
  let vx = 0;
  let vy = 0;
  const path = [];
  for (let i = 0; i <= steps; i += 1) {
    const loss = surface.f(x, y);
    const g = surface.grad(x, y);
    path.push({ x, y, loss, gx: g.x, gy: g.y });
    if (!Number.isFinite(loss) || Math.abs(x) > 50 || Math.abs(y) > 50) break;
    vx = momentum * vx - lr * g.x;
    vy = momentum * vy - lr * g.y;
    x += vx;
    y += vy;
  }
  return { surfaceId, lr, momentum, path, start: s0 };
}

export function diagnoseRun(run) {
  const losses = run.path.map((p) => p.loss);
  const first = losses[0];
  const last = losses.at(-1);
  const max = Math.max(...losses.filter((v) => Number.isFinite(v)));
  if (!Number.isFinite(last) || max > Math.max(8, first * 6) || Math.abs(run.path.at(-1).x) > 20) {
    return "diverged";
  }
  if (last < 0.05) return "converged";
  if (last > first * 0.55) return "crawling";
  return "progressing";
}

export function gradeDescent(challenge, answer) {
  if (challenge.type === "pick") {
    const choice = typeof answer === "string" ? answer : answer?.choice;
    if (choice === challenge.best) return { points: 3, label: "Best pick" };
    return { points: 0, label: "Not the lesson" };
  }
  const run = answer;
  const within = run.path.filter((_, i) => i <= challenge.maxSteps);
  const hit = within.some((p) => Number.isFinite(p.loss) && p.loss <= challenge.targetLoss);
  const diag = diagnoseRun(run);
  if (diag === "diverged") return { points: 0, label: "Diverged — shrink the learning rate" };
  if (hit) return { points: 3, label: "Reached the floor in budget" };
  if (diag === "crawling") return { points: 1, label: "Crawling — raise η a bit" };
  return { points: 1, label: "Progress, but still above the loss bar" };
}

export function contourGrid(surfaceId, { n = 40 } = {}) {
  const s = SURFACES[surfaceId];
  const { lo, hi } = s.bounds;
  const step = (hi - lo) / n;
  const cells = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const x = lo + (j + 0.5) * step;
      const y = lo + (i + 0.5) * step;
      const z = s.f(x, y);
      min = Math.min(min, z);
      max = Math.max(max, z);
      cells.push({ x, y, z });
    }
  }
  return { cells, lo, hi, n, step, min, max };
}
