import { layout, mount, on, escapeHtml } from "../ui.js";
import { loadProgress, resetProgress, starString, totalStars } from "../progress.js";

function card(game, progress, featured = false) {
  const rec = progress[game.id] || {};
  const status = rec.completed ? "Completed" : rec.lastPlayed ? "In progress" : "Not started";
  return `
    <a class="card ${featured ? "featured" : ""}" href="#/${game.id}">
      <p class="eyebrow">${featured ? "Featured lab" : "Lab"} · ${status}</p>
      <h2>${escapeHtml(game.title)}</h2>
      <p class="muted">${escapeHtml(game.blurb)}</p>
      <p class="stars" aria-label="${rec.stars || 0} of 5 stars">${starString(rec.stars || 0)}</p>
      <p class="faint">Best score ${rec.bestScore || 0}</p>
    </a>
  `;
}

export function homePage(root) {
  const ac = new AbortController();
  const draw = () => {
    const progress = loadProgress();
    const games = [
      {
        id: "boosting",
        title: "Boosting Showdown",
        blurb:
          "Twelve client briefs plus a live tradeoff lab: CatBoost categoricals, LightGBM leaf-wise speed, XGBoost regularization, missing values, sparsity, GPU myths, ordered boosting.",
      },
      {
        id: "overfitting",
        title: "Overfitting Arena",
        blurb: "Fit noisy curves against a holdout. Capacity and ridge are your only weapons.",
      },
      {
        id: "sampling",
        title: "Sampling Bias Race",
        blurb: "Convenience, voluntary response, survivorship, recency — watch the estimate miss the truth.",
      },
    ];
    mount(
      root,
      layout({
        title: "Lobby",
        body: `
          <section class="hero">
            <p class="eyebrow">Classroom arcade for tabular instincts</p>
            <h1>Train on purpose.<br/>Hold out the hype.</h1>
            <p class="lede">Three short labs for data science students. Progress lives in this browser. Unlock once with the site password; the games then remember your stars locally.</p>
          </section>
          <section class="kpis" aria-label="Progress">
            <div class="kpi"><div class="label">Stars</div><div class="value">${totalStars(progress)} / 15</div></div>
            <div class="kpi"><div class="label">Games cleared</div><div class="value">${["boosting", "overfitting", "sampling"].filter((id) => progress[id].completed).length} / 3</div></div>
            <div class="kpi"><div class="label">Best boosting</div><div class="value">${progress.boosting.bestScore || 0}</div></div>
          </section>
          <section class="game-grid">
            ${card(games[0], progress, true)}
            <div class="secondary">
              ${card(games[1], progress)}
              ${card(games[2], progress)}
            </div>
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
