import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { SCENARIOS, LAB_BRIEFS } from "./scenarios.js";
import {
  LIBS,
  LIB_META,
  explainRecommendation,
  gradePick,
  scoreLibraries,
  starsFromRatio,
} from "./recommend.js";

const MAX_SCORE = SCENARIOS.length * 3 + LAB_BRIEFS.length * 2;

function libButton(id, selected) {
  const meta = LIB_META[id];
  return `
    <button class="library ${id}" type="button" data-lib="${id}" aria-pressed="${selected === id}">
      <span class="name">${meta.name}</span>
      <span class="muted">${meta.blurb}</span>
    </button>
  `;
}

function meter(done, total) {
  const pct = Math.round((done / total) * 100);
  return `
    <div class="progress-meter">
      <div class="faint">${done} / ${total} locked in</div>
      <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

export function boostingPage(root) {
  let bound = false;
  const ac = new AbortController();
  const state = {
    phase: "intro",
    index: 0,
    choice: null,
    feedback: null,
    score: 0,
    recap: [],
    lab: {
      rows: 250000,
      catShare: 0.35,
      cardinality: 256,
      missing: 0.1,
      sparsity: 0.12,
      gpu: false,
      tightTrain: true,
      fastInfer: false,
      xgbTeam: false,
    },
    briefIndex: 0,
    briefChoice: null,
    briefFeedback: null,
  };

  function render() {
    mount(root, layout({ title: "Boosting Showdown", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function body() {
    if (state.phase === "intro") return intro();
    if (state.phase === "play") return play();
    if (state.phase === "lab") return lab();
    return recap();
  }

  function intro() {
    return `
      <section class="instructions">
        <p class="eyebrow">Game 1 · 12 briefs + live lab</p>
        <h1 class="page-title">Boosting Showdown</h1>
        <p class="lede">LightGBM, XGBoost, and CatBoost all grow boosted trees. They do not all want the same table. You will play twelve scenario briefs, then a live tradeoff lab with four client specs.</p>
      </section>
      <div class="scenario">
        <article class="brief">
          <h2>How to play</h2>
          <ol>
            <li>Read the constraints like a staff-level reviewer: n, cats, sparsity, budgets, politics.</li>
            <li>Pick a library. Keys <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> also work.</li>
            <li>Best pick: 3 points. Solid runner-up: 1 point. Then we tell you why.</li>
            <li>In the lab, drag the sliders until you can feel the recommendation move — then lock four briefs.</li>
          </ol>
          <div class="actions">
            <button class="btn btn-primary" data-action="start" type="button">Start the first brief</button>
          </div>
        </article>
        <aside class="panel">
          <p class="eyebrow">Cheat sheet you will earn</p>
          <p><strong>CatBoost</strong> — categoricals, ordered boosting, missing-as-category, symmetric trees, small messy n.</p>
          <p><strong>LightGBM</strong> — leaf-wise histograms, huge CPU tables, tight train budgets.</p>
          <p><strong>XGBoost</strong> — regularization, sparse matrices, sklearn/SHAP/review culture, the boring default.</p>
          <p class="faint">GPU is a workload property, not a personality trait.</p>
        </aside>
      </div>
    `;
  }

  function play() {
    const scenario = SCENARIOS[state.index];
    const fb = state.feedback;
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Brief ${state.index + 1} of ${SCENARIOS.length} · ${escapeHtml(scenario.topic)}</p>
          <h1 class="page-title">${escapeHtml(scenario.title)}</h1>
        </div>
        <div>
          ${meter(state.index + (fb ? 1 : 0), SCENARIOS.length)}
          <p class="faint">Score ${state.score} · max ${MAX_SCORE}</p>
        </div>
      </div>
      <div class="scenario">
        <article class="brief">
          <p>${escapeHtml(scenario.setup)}</p>
          <div class="stat-row">${scenario.chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("")}</div>
          <p><strong>${escapeHtml(scenario.prompt)}</strong></p>
          ${fb ? feedbackBlock(scenario, fb) : ""}
          <div class="actions">
            ${fb
              ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === SCENARIOS.length - 1 ? "Enter the tradeoff lab" : "Next brief"}</button>`
              : `<button class="btn btn-primary" data-action="lock" type="button" ${state.choice ? "" : "disabled"}>Lock in pick</button>`}
          </div>
        </article>
        <aside class="panel">
          <div class="libraries" role="group" aria-label="Choose a boosting library">
            ${LIBS.map((id) => libButton(id, state.choice)).join("")}
          </div>
        </aside>
      </div>
    `;
  }

  function feedbackBlock(scenario, fb) {
    const cls = fb.tier === "best" ? "good" : fb.tier === "ok" ? "ok" : "bad";
    return `
      <div class="feedback ${cls}" role="status">
        <p><strong>${fb.label}.</strong> ${escapeHtml(scenario.why[state.choice])}</p>
        ${scenario.note ? `<p class="muted">${escapeHtml(scenario.note)}</p>` : ""}
        <p class="faint">What you should keep: ${escapeHtml(scenario.learned)}</p>
      </div>
    `;
  }

  function lab() {
    const rec = explainRecommendation(state.lab);
    const max = Math.max(...Object.values(rec.scores), 0.01);
    const brief = LAB_BRIEFS[state.briefIndex];
    const fb = state.briefFeedback;
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Tradeoff lab · live scoring</p>
          <h1 class="page-title">Twiddle the table until the winner moves</h1>
        </div>
        <p class="faint">Score ${state.score} · client brief ${state.briefIndex + 1}/${LAB_BRIEFS.length}</p>
      </div>
      <p class="instructions">This is not magic: the meters are a transparent heuristic covering size, cats, sparsity, GPU amortization, inference, and whether the team already lives in XGBoost. Use it to build intuition, then pick a library for the client brief on the right.</p>
      <div class="sim-grid">
        <section class="panel">
          ${slider("rows", "Rows (log-ish)", state.lab.rows, 1000, 20000000, true)}
          ${slider("catShare", "Categorical share", state.lab.catShare, 0, 1, false, true)}
          ${slider("cardinality", "Max category cardinality", state.lab.cardinality, 4, 20000, true)}
          ${slider("missing", "Missingness", state.lab.missing, 0, 0.7, false, true)}
          ${slider("sparsity", "Sparsity (true CSR zeros)", state.lab.sparsity, 0, 0.98, false, true)}
          <label class="control"><span><input type="checkbox" data-flag="gpu" ${state.lab.gpu ? "checked" : ""}/> GPU in the room</span></label>
          <label class="control"><span><input type="checkbox" data-flag="tightTrain" ${state.lab.tightTrain ? "checked" : ""}/> Tight training budget</span></label>
          <label class="control"><span><input type="checkbox" data-flag="fastInfer" ${state.lab.fastInfer ? "checked" : ""}/> Strict CPU inference SLA</span></label>
          <label class="control"><span><input type="checkbox" data-flag="xgbTeam" ${state.lab.xgbTeam ? "checked" : ""}/> Team already ships XGBoost</span></label>
          <div class="bars" aria-live="polite">
            ${LIBS.map((id) => {
              const width = Math.max(8, (rec.scores[id] / max) * 100);
              return `<div><div class="faint">${LIB_META[id].name}${rec.winner === id ? " · recommended" : ""}</div>
                <div class="bar-track ${id}"><span style="width:${width}%"></span></div></div>`;
            }).join("")}
          </div>
          <ul class="learn-list">${rec.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
        </section>
        <section class="panel">
          <p class="eyebrow">Client brief</p>
          <h2>${escapeHtml(brief.title)}</h2>
          <p>${escapeHtml(brief.hint)}</p>
          <p class="faint">${formatSpec(brief.spec)}</p>
          <div class="libraries">
            ${LIBS.map((id) => libButton(id, state.briefChoice)).join("")}
          </div>
          ${fb ? `<div class="feedback ${fb.tier === "best" ? "good" : fb.tier === "ok" ? "ok" : "bad"}" role="status"><p><strong>${fb.label}.</strong> Heuristic winner: ${LIB_META[scoreLibraries(brief.spec).winner].name}.</p></div>` : ""}
          <div class="actions">
            ${fb
              ? `<button class="btn btn-primary" data-action="next-brief" type="button">${state.briefIndex === LAB_BRIEFS.length - 1 ? "See recap" : "Next client"}</button>`
              : `<button class="btn btn-primary" data-action="lock-brief" type="button" ${state.briefChoice ? "" : "disabled"}>Lock client pick</button>`}
            <button class="btn" data-action="load-brief" type="button">Load this spec into sliders</button>
          </div>
        </section>
      </div>
    `;
  }

  function slider(key, label, value, min, max, log = false, pct = false) {
    const shown = pct ? `${Math.round(value * 100)}%` : Number(value).toLocaleString();
    return `
      <div class="control">
        <label for="ctrl-${key}">${escapeHtml(label)} · <span class="faint">${shown}</span></label>
        <input id="ctrl-${key}" data-slider="${key}" type="range" min="${min}" max="${max}" step="${pct ? 0.01 : 1}" value="${value}" />
      </div>
    `;
  }

  function formatSpec(spec) {
    return `${spec.rows.toLocaleString()} rows · cats ${Math.round(spec.catShare * 100)}% · card ${spec.cardinality} · miss ${Math.round(spec.missing * 100)}% · sparse ${Math.round(spec.sparsity * 100)}% · GPU ${spec.gpu ? "yes" : "no"}`;
  }

  function recap() {
    const stars = starsFromRatio(state.score / MAX_SCORE);
    saveGame("boosting", {
      score: state.score,
      bestScore: state.score,
      stars,
      completed: true,
      recap: state.recap,
    });
    return `
      <section class="recap">
        <p class="eyebrow">What you learned</p>
        <h2>Boosting is a matching problem</h2>
        <p>You scored <strong>${state.score}</strong> / ${MAX_SCORE} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
        <ul class="learn-list">
          ${[...new Set(state.recap)].map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          <li>Leaf-wise (LightGBM) vs level-wise (XGBoost) vs symmetric (CatBoost) is a capacity and speed story, not a brand story.</li>
          <li>GPU myths die on small n. GPU reality shows up on large histograms, especially cat-heavy CatBoost jobs.</li>
          <li>Ordered boosting is specifically about target-statistic leakage / prediction shift — not a synonym for “regularization.”</li>
        </ul>
        <div class="actions">
          <a class="btn btn-primary" href="#/">Back to the lab lobby</a>
          <button class="btn" data-action="replay" type="button">Replay showdown</button>
        </div>
      </section>
    `;
  }

  function bind(signal) {
    const listen = (type, sel, fn) => on(root, type, sel, fn, signal);
    listen("click", "[data-action=start]", () => {
      state.phase = "play";
      render();
    });
    listen( "click", "[data-action=replay]", () => {
      state.phase = "intro";
      state.index = 0;
      state.choice = null;
      state.feedback = null;
      state.score = 0;
      state.recap = [];
      state.briefIndex = 0;
      state.briefChoice = null;
      state.briefFeedback = null;
      render();
    });
    listen( "click", "[data-lib]", (e, target) => {
      const lib = target.getAttribute("data-lib");
      if (state.phase === "play" && !state.feedback) {
        state.choice = lib;
        render();
      } else if (state.phase === "lab" && !state.briefFeedback) {
        state.briefChoice = lib;
        render();
      }
    });
    listen( "click", "[data-action=lock]", () => {
      if (!state.choice || state.feedback) return;
      const scenario = SCENARIOS[state.index];
      state.feedback = gradePick(state.choice, scenario.best, scenario.acceptable);
      state.score += state.feedback.points;
      state.recap.push(scenario.learned);
      render();
    });
    listen( "click", "[data-action=next]", () => {
      if (state.index >= SCENARIOS.length - 1) {
        state.phase = "lab";
      } else {
        state.index += 1;
        state.choice = null;
        state.feedback = null;
      }
      render();
    });
    listen( "click", "[data-action=lock-brief]", () => {
      if (!state.briefChoice || state.briefFeedback) return;
      const brief = LAB_BRIEFS[state.briefIndex];
      state.briefFeedback = gradePick(state.briefChoice, brief.best, brief.acceptable);
      state.briefFeedback.points = state.briefFeedback.tier === "best" ? 2 : state.briefFeedback.points ? 1 : 0;
      state.score += state.briefFeedback.points;
      render();
    });
    listen( "click", "[data-action=next-brief]", () => {
      if (state.briefIndex >= LAB_BRIEFS.length - 1) {
        state.phase = "recap";
      } else {
        state.briefIndex += 1;
        state.briefChoice = null;
        state.briefFeedback = null;
      }
      render();
    });
    listen( "click", "[data-action=load-brief]", () => {
      state.lab = { ...LAB_BRIEFS[state.briefIndex].spec };
      render();
    });
    listen( "input", "[data-slider]", (e, target) => {
      const key = target.getAttribute("data-slider");
      state.lab[key] = Number(target.value);
      const rec = explainRecommendation(state.lab);
      const max = Math.max(...Object.values(rec.scores), 0.01);
      const control = target.closest(".control");
      const labelValue = control?.querySelector(".faint");
      if (labelValue) {
        const pct = key === "catShare" || key === "missing" || key === "sparsity";
        labelValue.textContent = pct
          ? `${Math.round(state.lab[key] * 100)}%`
          : Number(state.lab[key]).toLocaleString();
      }
      const bars = root.querySelector(".bars");
      if (bars) {
        bars.innerHTML = LIBS.map((id) => {
          const width = Math.max(8, (rec.scores[id] / max) * 100);
          return `<div><div class="faint">${LIB_META[id].name}${rec.winner === id ? " · recommended" : ""}</div>
            <div class="bar-track ${id}"><span style="width:${width}%"></span></div></div>`;
        }).join("");
      }
      const list = root.querySelector(".learn-list");
      if (list) list.innerHTML = rec.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    });
    listen( "change", "[data-flag]", (e, target) => {
      state.lab[target.getAttribute("data-flag")] = target.checked;
      render();
    });

    function keyHandler(e) {
      if (e.target.matches("input, textarea")) return;
      const map = { "1": "lightgbm", "2": "xgboost", "3": "catboost" };
      if (map[e.key]) {
        if (state.phase === "play" && !state.feedback) state.choice = map[e.key];
        if (state.phase === "lab" && !state.briefFeedback) state.briefChoice = map[e.key];
        render();
      }
    }
    window.addEventListener("keydown", keyHandler, { signal });
  }

  boostingPage.teardown = () => {
    ac.abort();
  };

  render();
}
