import { layout, mount, on, escapeHtml } from "../ui.js";
import { GAMES, loadProgress, resetProgress, starString, totalStars } from "../progress.js";

const BLURBS = {
  boosting:
    "Twelve client briefs plus a live tradeoff lab: CatBoost categoricals, LightGBM leaf-wise speed, XGBoost regularization, missing values, sparsity, GPU myths, ordered boosting.",
  overfitting: "Fit noisy curves against a holdout. Capacity and ridge are your only weapons.",
  sampling: "Convenience, voluntary response, survivorship, recency — watch the estimate miss the truth.",
  classifiers:
    "Same 2D toys, three linear scores. When OLS leaks out of [0, 1], when logistic is the probability, when the perceptron never converges.",
  mlp: "Stack layers, pick ReLU / tanh / sigmoid, and watch capacity fold XOR, moons, and circles.",
  descent: "Contour, learning rate, optional momentum. Too high diverges, too low crawls, just-right hits the floor.",
  backprop: "Step a 2→2→1 net: activations, loss, then blame flowing backward. Spot vanishing gradients.",
  tree: "Grow or place axis-aligned splits. Beat a baseline with a stump; watch a deep tree memorize noise.",
};

function card(game, progress, featured = false) {
  const rec = progress[game.id] || {};
  const status = rec.completed ? "Completed" : rec.lastPlayed ? "In progress" : "Not started";
  return `
    <a class="card ${featured ? "featured" : ""}" href="#/${game.id}">
      <p class="eyebrow">${featured ? "Featured lab" : "Lab"} · ${status}</p>
      <h2>${escapeHtml(game.title)}</h2>
      <p class="muted">${escapeHtml(BLURBS[game.id] || "")}</p>
      <p class="stars" aria-label="${rec.stars || 0} of 5 stars">${starString(rec.stars || 0)}</p>
      <p class="faint">Best score ${rec.bestScore || 0}</p>
    </a>
  `;
}

export function homePage(root) {
  const ac = new AbortController();
  const draw = () => {
    const progress = loadProgress();
    const featured = GAMES[0];
    const rest = GAMES.slice(1);
    const cleared = GAMES.filter((g) => progress[g.id]?.completed).length;
    mount(
      root,
      layout({
        title: "Lobby",
        body: `
          <section class="hero">
            <p class="eyebrow">Classroom arcade for tabular instincts</p>
            <h1>Train on purpose.<br/>Hold out the hype.</h1>
            <p class="lede">Eight short labs for data science students — boosting libraries, generalization, sampling, classic linear models, MLPs, gradient descent, backprop, and trees. Progress lives in this browser.</p>
          </section>
          <section class="kpis" aria-label="Progress">
            <div class="kpi"><div class="label">Stars</div><div class="value">${totalStars(progress)} / ${GAMES.length * 5}</div></div>
            <div class="kpi"><div class="label">Games cleared</div><div class="value">${cleared} / ${GAMES.length}</div></div>
            <div class="kpi"><div class="label">Best boosting</div><div class="value">${progress.boosting.bestScore || 0}</div></div>
          </section>
          <section class="game-grid featured-row">
            ${card(featured, progress, true)}
          </section>
          <section class="game-grid-all">
            ${rest.map((game) => card(game, progress)).join("")}
          </section>
          <p class="faint" style="margin-top:22px">Need a clean slate? <button class="btn" type="button" data-action="reset">Reset local progress</button></p>
        `,
      }),
    );
  };
  on(root, "click", "[data-action=reset]", () => {
    if (window.confirm("Clear stars and scores stored in this browser?")) {
      resetProgress();
      draw();
    }
  }, ac.signal);
  homePage.teardown = () => ac.abort();
  draw();
}
