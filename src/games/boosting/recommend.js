export const LIBS = ["lightgbm", "xgboost", "catboost"];

export const LIB_META = {
  lightgbm: {
    name: "LightGBM",
    blurb: "Leaf-wise histograms. Built for large, mostly numeric tables and tight train budgets.",
  },
  xgboost: {
    name: "XGBoost",
    blurb: "Level-wise growth, sharp regularization, and the densest production/Kaggle ecosystem.",
  },
  catboost: {
    name: "CatBoost",
    blurb: "Ordered boosting and native categoricals. Strong on messy, small-to-medium tabular jobs.",
  },
};

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function logRows(rows) {
  return Math.log10(Math.max(rows, 100)) / 7; // 1e2 → 0, 1e7 → 1
}

export function scoreLibraries(input) {
  const rows = Number(input.rows) || 10000;
  const catShare = clamp(Number(input.catShare) || 0, 0, 1);
  const cardinality = Number(input.cardinality) || 16;
  const missing = clamp(Number(input.missing) || 0, 0, 1);
  const sparsity = clamp(Number(input.sparsity) || 0, 0, 1);
  const gpu = Boolean(input.gpu);
  const tightTrain = Boolean(input.tightTrain);
  const fastInfer = Boolean(input.fastInfer);
  const smallData = rows < 25000;
  const hugeData = rows >= 1_000_000;
  const xgbTeam = Boolean(input.xgbTeam);

  const lightgbm =
    2.4 * logRows(rows) +
    (tightTrain ? 1.6 : 0) +
    (hugeData ? 1.8 : 0) +
    sparsity * 1.1 +
    (smallData ? -1.8 : 0) +
    catShare * (cardinality > 200 ? -0.6 : 0.3) +
    (gpu && hugeData ? 0.6 : gpu && smallData ? -0.8 : 0);

  const xgboost =
    1.6 +
    (xgbTeam ? 1.8 : 0.4) +
    sparsity * 1.5 +
    (smallData ? 0.7 : 0) +
    (hugeData ? -0.7 : 0.4) +
    (gpu && rows > 80000 ? 0.8 : gpu && smallData ? -0.7 : 0.2) +
    catShare * (cardinality > 500 ? -0.8 : 0);

  const catboost =
    1.1 +
    catShare * 2.6 +
    Math.log10(Math.max(cardinality, 4)) * 0.7 +
    missing * 1.2 +
    (smallData ? 1.4 : 0) +
    (fastInfer ? 1.1 : 0) +
    (hugeData ? -1.5 : 0) +
    sparsity * -1.6 +
    (gpu && catShare > 0.25 && rows > 40000 ? 0.7 : 0);

  const scores = { lightgbm, xgboost, catboost };
  const ranked = LIBS.slice().sort((a, b) => scores[b] - scores[a]);
  return { scores, ranked, winner: ranked[0], runnerUp: ranked[1] };
}

export function explainRecommendation(input, result = scoreLibraries(input)) {
  const reasons = [];
  if (input.catShare >= 0.3) {
    reasons.push("A large categorical share favors CatBoost’s native handling and ordered target stats.");
  }
  if (input.rows >= 1_000_000) {
    reasons.push("Million-row scale usually rewards LightGBM’s leaf-wise histograms and lighter memory.");
  }
  if (input.rows < 25000) {
    reasons.push("Small n makes LightGBM’s leaf-wise growth easy to overfit unless you regularize hard.");
  }
  if (input.sparsity >= 0.6) {
    reasons.push("Very sparse matrices are historically an XGBoost (then LightGBM) comfort zone, not CatBoost’s.");
  }
  if (input.gpu && input.rows < 20000) {
    reasons.push("GPU launch overhead can lose to CPU on small tables. GPU is not a free speedup.");
  }
  if (input.fastInfer) {
    reasons.push("CatBoost’s symmetric / oblivious trees are often the easiest CPU inference story.");
  }
  if (input.xgbTeam) {
    reasons.push("An existing XGBoost + SHAP + sklearn stack is a real constraint, not a vanity default.");
  }
  if (input.missing >= 0.2) {
    reasons.push("All three learn missingness, but CatBoost’s categorical missing-as-category is especially tidy.");
  }
  if (!reasons.length) {
    reasons.push("With mixed, medium-scale numeric data, XGBoost is the safest documented default.");
  }
  return { ...result, reasons };
}

export function gradePick(choice, best, acceptable = []) {
  if (choice === best) return { tier: "best", points: 3, label: "Best pick" };
  if (acceptable.includes(choice)) return { tier: "ok", points: 1, label: "Acceptable, not ideal" };
  return { tier: "miss", points: 0, label: "Weak match for this brief" };
}

export function starsFromRatio(ratio) {
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.58) return 3;
  if (ratio >= 0.4) return 2;
  if (ratio >= 0.2) return 1;
  return 0;
}
