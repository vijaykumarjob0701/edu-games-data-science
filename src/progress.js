const KEY = "split-lab-progress-v1";

const emptyGame = () => ({
  stars: 0,
  bestScore: 0,
  completed: false,
  lastPlayed: null,
  recap: [],
});

export const GAMES = [
  { id: "boosting", title: "Boosting Showdown" },
  { id: "overfitting", title: "Overfitting Arena" },
  { id: "sampling", title: "Sampling Bias Race" },
  { id: "classifiers", title: "Linear vs Logistic vs Perceptron" },
  { id: "mlp", title: "MLP Lab" },
  { id: "descent", title: "Gradient Descent Playground" },
  { id: "backprop", title: "Forward & Backprop" },
  { id: "tree", title: "Decision Tree Builder" },
];

export function defaultProgress() {
  const progress = {};
  for (const game of GAMES) progress[game.id] = emptyGame();
  return progress;
}

export function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!parsed || typeof parsed !== "object") return defaultProgress();
    const base = defaultProgress();
    for (const game of GAMES) {
      base[game.id] = { ...base[game.id], ...(parsed[game.id] || {}) };
    }
    return base;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
  return progress;
}

export function saveGame(id, patch) {
  const progress = loadProgress();
  const current = progress[id] || emptyGame();
  progress[id] = {
    ...current,
    ...patch,
    bestScore: Math.max(current.bestScore || 0, patch.bestScore ?? patch.score ?? 0),
    stars: Math.max(current.stars || 0, patch.stars || 0),
    lastPlayed: new Date().toISOString(),
  };
  return saveProgress(progress);
}

export function resetProgress() {
  localStorage.removeItem(KEY);
  return defaultProgress();
}

export function totalStars(progress = loadProgress()) {
  return GAMES.reduce((sum, game) => sum + (progress[game.id]?.stars || 0), 0);
}

export function starString(n, max = 5) {
  return `${"★".repeat(n)}${"☆".repeat(Math.max(0, max - n))}`;
}
