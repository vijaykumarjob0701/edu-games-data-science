import { describe, expect, it } from "vitest";
import { GAMES, defaultProgress } from "../src/progress.js";
import { treePage } from "../src/games/tree/game.js";
import { classifiersPage } from "../src/games/classifiers/game.js";
import { mlpPage } from "../src/games/mlp/game.js";
import { descentPage } from "../src/games/descent/game.js";
import { backpropPage } from "../src/games/backprop/game.js";
import {
  DATASETS as CLF_DATA,
  makePoints as makeClfPoints,
  fitLinear,
  trainLogistic,
  trainPerceptron,
  accuracy,
  predictValue,
  gradeChallenge as gradeClf,
  CHALLENGES as CLF_CHALLENGES,
} from "../src/games/classifiers/engine.js";
import {
  DATASETS as MLP_DATA,
  makePoints as makeMlpPoints,
  initNet,
  trainNet,
  mlpAccuracy,
  forwardActivations,
  gradeMlpChallenge,
  CHALLENGES as MLP_CHALLENGES,
} from "../src/games/mlp/engine.js";
import {
  SURFACES,
  runDescent,
  diagnoseRun,
  gradeDescent,
  CHALLENGES as GD_CHALLENGES,
} from "../src/games/descent/engine.js";
import {
  demoNet,
  forwardPass,
  backwardPass,
  applyUpdate,
  layerGradNorms,
  gradeBackprop,
  QUIZZES as BP_QUIZZES,
} from "../src/games/backprop/engine.js";
import {
  gini,
  entropy,
  makePoints as makeTreePoints,
  growTree,
  treeAccuracy,
  bestSplit,
  gradeTree,
  CHALLENGES as TREE_CHALLENGES,
} from "../src/games/tree/engine.js";

describe("new game pages export", () => {
  it("exposes a page function for each new lab", () => {
    for (const page of [classifiersPage, mlpPage, descentPage, backpropPage, treePage]) {
      expect(typeof page).toBe("function");
    }
  });
});

describe("lobby registry", () => {
  it("registers eight labs including the five new ones", () => {
    expect(GAMES.map((g) => g.id)).toEqual([
      "boosting",
      "overfitting",
      "sampling",
      "classifiers",
      "mlp",
      "descent",
      "backprop",
      "tree",
    ]);
    const progress = defaultProgress();
    for (const id of GAMES.map((g) => g.id)) {
      expect(progress[id].stars).toBe(0);
      expect(progress[id].completed).toBe(false);
    }
  });
});

describe("classifiers engine", () => {
  it("exposes switchable toy datasets", () => {
    expect(CLF_DATA.map((d) => d.id)).toEqual(["blobs", "outliers", "xor", "line"]);
  });

  it("lets logistic beat linear regression accuracy on binary outliers", () => {
    const pts = makeClfPoints("outliers", 80, 4);
    const lin = fitLinear(pts);
    const log = trainLogistic(pts, { lr: 0.4, epochs: 250 });
    expect(accuracy(log, pts)).toBeGreaterThan(accuracy(lin, pts));
    const far = predictValue(lin, 8, 8);
    expect(far > 1.05 || far < -0.05).toBe(true);
  });

  it("has the perceptron fail to linearly separate XOR", () => {
    const pts = makeClfPoints("xor", 80, 2);
    const perc = trainPerceptron(pts, { lr: 0.2, epochs: 80 });
    expect(accuracy(perc, pts)).toBeLessThan(0.8);
    const log = trainLogistic(pts, { lr: 0.5, epochs: 200 });
    expect(accuracy(log, pts)).toBeLessThan(0.85);
  });

  it("grades scenario picks like the boosting briefs", () => {
    const prob = CLF_CHALLENGES.find((c) => c.id === "prob-task");
    expect(gradeClf(prob, "logistic").points).toBe(3);
    expect(gradeClf(prob, "perceptron").points).toBe(1);
    expect(gradeClf(prob, "linear").points).toBe(0);
  });
});

describe("mlp engine", () => {
  it("cannot separate XOR with a linear (no-hidden) net", () => {
    const pts = makeMlpPoints("xor", 80, 1);
    const linear = initNet({ hidden: 0, width: 1, activation: "relu", seed: 3 });
    trainNet(linear, pts, { lr: 0.3, epochs: 200 });
    expect(mlpAccuracy(linear, pts)).toBeLessThan(0.7);
  });

  it("separates XOR with a small nonlinear hidden layer", () => {
    const pts = makeMlpPoints("xor", 80, 1);
    const net = initNet({ hidden: 1, width: 6, activation: "relu", seed: 7 });
    trainNet(net, pts, { lr: 0.35, epochs: 700 });
    expect(mlpAccuracy(net, pts)).toBeGreaterThan(0.85);
  });

  it("exposes a forward-pass activation trace", () => {
    const net = initNet({ hidden: 1, width: 3, activation: "tanh", seed: 1 });
    const trace = forwardActivations(net, 0.4, -0.2);
    expect(trace.layers.length).toBeGreaterThanOrEqual(2);
    expect(trace.output).toBeGreaterThan(0);
    expect(trace.output).toBeLessThan(1);
  });

  it("fails the XOR challenge when capacity is linear", () => {
    const ch = MLP_CHALLENGES.find((c) => c.id === "xor");
    expect(gradeMlpChallenge(ch, { hidden: 0, width: 4, activation: "relu", acc: 0.5 }).points).toBe(0);
    expect(gradeMlpChallenge(ch, { hidden: 1, width: 4, activation: "relu", acc: 0.92 }).points).toBe(3);
  });

  it("lists moons, circles, and xor toys", () => {
    expect(MLP_DATA.map((d) => d.id).sort()).toEqual(["circles", "moons", "xor"]);
  });
});

describe("gradient descent engine", () => {
  it("converges on the bowl with a moderate learning rate", () => {
    const run = runDescent("bowl", { lr: 0.15, momentum: 0, steps: 40, start: SURFACES.bowl.start });
    expect(run.path.at(-1).loss).toBeLessThan(0.02);
    expect(diagnoseRun(run)).toBe("converged");
  });

  it("diverges when the learning rate is too high", () => {
    const run = runDescent("bowl", { lr: 2.4, momentum: 0, steps: 12, start: SURFACES.bowl.start });
    expect(diagnoseRun(run)).toBe("diverged");
  });

  it("crawls when the learning rate is tiny", () => {
    const run = runDescent("bowl", { lr: 0.002, momentum: 0, steps: 25, start: SURFACES.bowl.start });
    expect(diagnoseRun(run)).toBe("crawling");
  });

  it("grades a loss-threshold challenge", () => {
    const ch = GD_CHALLENGES.find((c) => c.id === "bowl-race");
    const good = runDescent("bowl", { lr: 0.2, momentum: 0, steps: 40, start: SURFACES.bowl.start });
    expect(gradeDescent(ch, good).points).toBe(3);
  });
});

describe("backprop engine", () => {
  it("runs a 2→2→1 forward pass then backward gradients", () => {
    const net = demoNet();
    const fwd = forwardPass(net, [0.5, -0.2]);
    expect(fwd.output).toBeGreaterThan(0);
    expect(fwd.output).toBeLessThan(1);
    const back = backwardPass(net, [0.5, -0.2], 1);
    expect(back.dW.length).toBe(2);
    expect(back.dW[0].length).toBe(2);
  });

  it("takes a gradient step that reduces loss on a labeled example", () => {
    const net = demoNet();
    const x = [0.8, 0.1];
    const y = 1;
    const before = forwardPass(net, x).loss(y);
    const back = backwardPass(net, x, y);
    applyUpdate(net, back, 0.8);
    const after = forwardPass(net, x).loss(y);
    expect(after).toBeLessThan(before);
  });

  it("shows vanishing gradients in a deep sigmoid net with small weights", () => {
    const norms = layerGradNorms({ depth: 5, width: 2, act: "sigmoid", scale: 0.25, seed: 2 });
    expect(norms[0]).toBeLessThan(norms.at(-1) * 0.4);
  });

  it("grades quiz beats", () => {
    const q = BP_QUIZZES.find((item) => item.id === "bigger-update");
    expect(gradeBackprop(q, q.best).points).toBe(3);
    expect(gradeBackprop(q, "wrong").points).toBe(0);
  });
});

describe("decision tree engine", () => {
  it("is zero impurity on a pure leaf", () => {
    expect(gini([1, 1, 1, 1])).toBe(0);
    expect(entropy([0, 0, 0])).toBe(0);
    expect(gini([1, 0, 1, 0])).toBeCloseTo(0.5, 5);
  });

  it("finds an axis-aligned split that separates blobs", () => {
    const pts = makeTreePoints("blobs", 60, 5);
    const split = bestSplit(pts, "gini");
    expect(["x", "y"]).toContain(split.feature);
    expect(Number.isFinite(split.threshold)).toBe(true);
  });

  it("overfits a deep tree on noisy data relative to a stump", () => {
    const train = makeTreePoints("noisy", 50, 8);
    const val = makeTreePoints("noisy", 80, 99);
    const stump = growTree(train, { maxDepth: 1, minLeaf: 2, criterion: "gini" });
    const deep = growTree(train, { maxDepth: 8, minLeaf: 1, criterion: "gini" });
    expect(treeAccuracy(deep, train)).toBeGreaterThanOrEqual(treeAccuracy(stump, train));
    expect(treeAccuracy(deep, train)).toBeGreaterThan(treeAccuracy(deep, val));
  });

  it("grades a shallow-tree accuracy challenge", () => {
    const ch = TREE_CHALLENGES.find((c) => c.id === "shallow-blobs");
    expect(gradeTree(ch, { depth: 2, acc: 0.92 }).points).toBe(3);
    expect(gradeTree(ch, { depth: 6, acc: 0.99 }).points).toBe(0);
  });
});
