import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { starsFromRatio } from "../boosting/recommend.js";
import { meter, scatterSurface } from "../_shared/plot.js";
import {
  CHALLENGES,
  DATASETS,
  accuracy,
  decisionGrid,
  gradeChallenge,
  isModelQuiz,
  makePoints,
  resolveAnswer,
  trainModel,
} from "./engine.js";

const MAX = CHALLENGES.length * 3;
const MODELS = [
  { id: "linear", name: "Linear regression", blurb: "Unbounded plane, MSE." },
  { id: "logistic", name: "Logistic regression", blurb: "Sigmoid probability." },
  { id: "perceptron", name: "Perceptron", blurb: "Hard 0/1 updates." },
];

export function classifiersPage(root) {
  let bound = false;
  const ac = new AbortController();
  const cache = {};
  const state = {
    phase: "intro",
    index: 0,
    model: "logistic",
    lr: 0.35,
    epochs: 180,
    locked: null,
    pick: null,
    hint: "",
    score: 0,
    recap: [],
  };

  function points() {
    const ch = CHALLENGES[state.index];
    const key = ch.dataset;
    if (!cache[key]) cache[key] = makePoints(key, 90, 4);
    return cache[key];
  }

  function fitted() {
    const pts = points();
    return trainModel(state.model, pts, { lr: state.lr, epochs: state.epochs });
  }

  function render() {
    mount(root, layout({ title: "Linear vs Logistic vs Perceptron", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 4 · 6 boundary duels</p>
          <h1 class="page-title">Linear vs Logistic vs Perceptron</h1>
          <p class="lede">Same 2D toys, three linear scores. Watch the overlay: OLS is unbounded, logistic is a probability, the perceptron is a hard cut. Then beat six short challenges — including the failure modes.</p>
        </section>
        <div class="scenario">
          <article class="brief">
            <h2>How to play</h2>
            <ol>
              <li>Switch datasets and models. The heat is the prediction; teal / coral dots are labels.</li>
              <li>On quiz rounds, lock the best explanation.</li>
              <li>On the fit round, train logistic until accuracy clears 90%.</li>
            </ol>
            <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Start the first duel</button></div>
          </article>
          <aside class="panel">
            <p class="eyebrow">What to notice</p>
            <p><strong>Linear</strong> — great for a continuous y; awkward as a classifier.</p>
            <p><strong>Logistic</strong> — the 0.5 contour is a line, the output is a probability.</p>
            <p><strong>Perceptron</strong> — converges only when a line can separate the classes.</p>
          </aside>
        </div>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / MAX);
      saveGame("classifiers", { score: state.score, bestScore: state.score, stars, completed: true, recap: state.recap });
      return recapHtml("Three linear scores, three jobs", state.score, MAX, stars, state.recap, [
        "Linear regression predicts a number. It does not know about [0, 1].",
        "Logistic regression is the probability version of the same hyperplane.",
        "The perceptron is a hard classifier and stalls when no separator exists.",
      ]);
    }

    const ch = CHALLENGES[state.index];
    const pts = points();
    const model = fitted();
    const acc = ch.dataset === "line" ? null : accuracy(model, pts);
    const grid = decisionGrid(model);
    const ds = DATASETS.find((d) => d.id === ch.dataset);
    const fb = state.locked;
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Duel ${state.index + 1} / ${CHALLENGES.length} · ${escapeHtml(ds.title)}</p>
          <h1 class="page-title">${escapeHtml(ch.title)}</h1>
          <p class="muted">${escapeHtml(ch.prompt)}</p>
        </div>
        <div>
          ${meter(state.index + (fb ? 1 : 0), CHALLENGES.length)}
          <p class="faint">Score ${state.score}</p>
        </div>
      </div>
      <div class="sim-grid">
        <section class="panel">
          ${scatterSurface({ points: pts, grid, label: `${state.model} overlay on ${ch.dataset}` })}
          <div class="legend">
            <span><i class="swatch" style="background:#3ecfb2"></i>Class 0 / low</span>
            <span><i class="swatch" style="background:#ff7a59"></i>Class 1 / high</span>
            <span><i class="swatch" style="background:#f0b429"></i>Heat = model output</span>
          </div>
          <p class="faint">${acc == null ? "Continuous target — read the plane, not accuracy." : `${MODELS.find((m) => m.id === state.model).name} accuracy ${(acc * 100).toFixed(0)}%`}</p>
        </section>
        <section class="panel">
          <p class="eyebrow">Overlay</p>
          <div class="choice-grid" role="group" aria-label="Overlay model">
            ${MODELS.map(
              (m) => `
              <button class="choice" type="button" data-model="${m.id}" aria-pressed="${state.model === m.id}">
                <strong>${escapeHtml(m.name)}</strong>
                <div class="faint">${escapeHtml(m.blurb)}</div>
              </button>`,
            ).join("")}
          </div>
          ${
            ch.type === "fit"
              ? `
            <div class="control">
              <label for="clf-lr">Learning rate (${state.lr.toFixed(2)})</label>
              <input id="clf-lr" data-slider="lr" type="range" min="0.05" max="1" step="0.05" value="${state.lr}" ${fb ? "disabled" : ""}/>
            </div>
            <div class="control">
              <label for="clf-ep">Epochs (${state.epochs})</label>
              <input id="clf-ep" data-slider="epochs" type="range" min="20" max="400" step="20" value="${state.epochs}" ${fb ? "disabled" : ""}/>
            </div>
            <p class="faint">Target ≥ ${(ch.targetAcc * 100).toFixed(0)}% with logistic. Train by locking the current overlay.</p>`
              : isModelQuiz(ch)
                ? `<p class="faint" style="margin-top:12px">Your answer is the overlay model highlighted above. Switch it, watch the heat, then lock.</p>`
                : `
            <p class="eyebrow" style="margin-top:14px">Your answer</p>
            <div class="choice-grid" role="group" aria-label="Answer">
              ${ch.options
                .map(
                  (opt) => `
                <button class="choice" type="button" data-pick="${opt.id}" aria-pressed="${state.pick === opt.id}" ${fb ? "disabled" : ""}>
                  <strong>${escapeHtml(opt.name)}</strong>
                  <div class="faint">${escapeHtml(opt.blurb || "")}</div>
                </button>`,
                )
                .join("")}
            </div>`
          }
          ${state.hint && !fb ? `<p class="faint" role="status">${escapeHtml(state.hint)}</p>` : ""}
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${escapeHtml(fb.label)}.</strong> ${escapeHtml(ch.learned)}</p></div>` : ""}
          <div class="actions">
            ${
              fb
                ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === CHALLENGES.length - 1 ? "Recap" : "Next duel"}</button>`
                : `<button class="btn btn-primary" data-action="lock" type="button">Lock in</button>`
            }
          </div>
        </section>
      </div>
    `;
  }

  function bind(signal) {
    const listen = (type, sel, fn) => on(root, type, sel, fn, signal);
    listen("click", "[data-action=start], [data-action=replay]", (e, target) => {
      if (target.getAttribute("data-action") === "replay") {
        state.index = 0;
        state.score = 0;
        state.recap = [];
      }
      state.phase = "play";
      state.locked = null;
      state.pick = null;
      state.hint = "";
      state.model = CHALLENGES[0].model || "logistic";
      render();
    });
    listen("click", "[data-model]", (e, target) => {
      if (state.locked) return;
      state.model = target.getAttribute("data-model");
      if (isModelQuiz(CHALLENGES[state.index])) state.pick = state.model;
      state.hint = "";
      render();
    });
    listen("click", "[data-pick]", (e, target) => {
      if (state.locked) return;
      state.pick = target.getAttribute("data-pick");
      render();
    });
    listen("input", "[data-slider=lr]", (e, target) => {
      state.lr = Number(target.value);
      const label = root.querySelector("label[for=clf-lr]");
      if (label) label.textContent = `Learning rate (${state.lr.toFixed(2)})`;
    });
    listen("input", "[data-slider=epochs]", (e, target) => {
      state.epochs = Number(target.value);
      const label = root.querySelector("label[for=clf-ep]");
      if (label) label.textContent = `Epochs (${state.epochs})`;
    });
    listen("change", "[data-slider]", () => render());
    listen("click", "[data-action=lock]", () => {
      const ch = CHALLENGES[state.index];
      if (ch.type === "fit") {
        const acc = accuracy(fitted(), points());
        state.locked = gradeChallenge(ch, acc);
      } else {
        const answer = resolveAnswer(ch, { pick: state.pick, model: state.model });
        if (!answer) {
          state.hint = "Choose an answer first, then lock.";
          render();
          return;
        }
        state.pick = answer;
        state.locked = gradeChallenge(ch, answer);
      }
      state.hint = "";
      state.score += state.locked.points;
      state.recap.push(ch.learned);
      render();
    });
    listen("click", "[data-action=next]", () => {
      if (state.index >= CHALLENGES.length - 1) state.phase = "recap";
      else {
        state.index += 1;
        state.locked = null;
        state.pick = null;
        state.hint = "";
        state.model = CHALLENGES[state.index].model || state.model;
      }
      render();
    });
  }

  classifiersPage.teardown = () => ac.abort();
  render();
}

function recapHtml(title, score, max, stars, recap, extras) {
  return `
    <section class="recap">
      <p class="eyebrow">What you learned</p>
      <h2>${title}</h2>
      <p>Score <strong>${score}</strong> / ${max} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
      <ul class="learn-list">
        ${[...new Set([...recap, ...extras])].map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
      <div class="actions">
        <a class="btn btn-primary" href="#/">Back to lobby</a>
        <button class="btn" data-action="replay" type="button">Replay</button>
      </div>
    </section>
  `;
}
