import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { ARENAS, evaluate, curve, gradeArena, makeSplit } from "./engine.js";
import { starsFromRatio } from "../boosting/recommend.js";

function poly(points, xScale, yScale) {
  return points
    .map((p, i) => `${i ? "L" : "M"}${xScale(p[0]).toFixed(1)},${yScale(p[1]).toFixed(1)}`)
    .join(" ");
}

function chart(result) {
  const w = 640;
  const h = 280;
  const pad = 28;
  const xScale = (x) => pad + x * (w - pad * 2);
  const yScale = (y) => {
    const t = (1.6 - y) / 2.2;
    return pad + t * (h - pad * 2);
  };
  const model = curve(result.predict);
  const dots = (split, fill) =>
    split.x
      .map((x, i) => `<circle cx="${xScale(x)}" cy="${yScale(split.y[i])}" r="3.2" fill="${fill}" opacity="0.85"/>`)
      .join("");
  return `
    <svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Train points, validation points, and fitted curve">
      <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
      <path d="${poly(model, xScale, yScale)}" fill="none" stroke="#f0b429" stroke-width="2.4"/>
      ${dots(result.train, "#3ecfb2")}
      ${dots(result.val, "#b39bff")}
    </svg>
  `;
}

export function overfittingPage(root) {
  let bound = false;
  const ac = new AbortController();
  const splits = ARENAS.map((arena) => makeSplit(arena));
  const state = {
    phase: "intro",
    index: 0,
    degree: 3,
    lambda: 0.08,
    locked: null,
    score: 0,
    recap: [],
  };

  function currentEval() {
    return evaluate(ARENAS[state.index], state.degree, state.lambda, splits[state.index]);
  }

  function render() {
    mount(root, layout({ title: "Overfitting Arena", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function refreshFit() {
    if (state.phase !== "play" || state.locked) return;
    const arena = ARENAS[state.index];
    const result = currentEval();
    const svg = root.querySelector(".chart");
    if (svg) svg.outerHTML = chart(result);
    const stats = root.querySelector("[data-fit-stats]");
    if (stats) {
      stats.textContent = `Train MSE ${result.trainMse.toFixed(3)} · Val MSE ${result.valMse.toFixed(3)} · gap ${result.gap.toFixed(3)} · target val ≤ ${arena.targetVal}`;
    }
    const degreeLabel = root.querySelector("[data-degree-label]");
    if (degreeLabel) degreeLabel.textContent = `Capacity (degree ${state.degree})`;
    const lambdaLabel = root.querySelector("[data-lambda-label]");
    if (lambdaLabel) lambdaLabel.textContent = `Ridge λ (${state.lambda.toFixed(2)})`;
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 2 · 6 holdout duels</p>
          <h1 class="page-title">Overfitting Arena</h1>
          <p class="lede">You only get credit for validation error. Drag capacity (polynomial degree) and ridge penalty until the purple holdout points look as calm as the teal training points — then lock.</p>
          <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Enter the arena</button></div>
        </section>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / (ARENAS.length * 3));
      saveGame("overfitting", {
        score: state.score,
        bestScore: state.score,
        stars,
        completed: true,
        recap: state.recap,
      });
      return `
        <section class="recap">
          <p class="eyebrow">What you learned</p>
          <h2>Train loss will lie to you</h2>
          <p>Score <strong>${state.score}</strong> / ${ARENAS.length * 3} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
          <ul class="learn-list">
            ${state.recap.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            <li>More capacity is not free. It spends degrees of freedom on whatever noise you sampled.</li>
            <li>Regularization and more data are two ways to buy back generalization.</li>
            <li>Early stopping is just watching the holdout and refusing extra capacity after val turns.</li>
          </ul>
          <div class="actions">
            <a class="btn btn-primary" href="#/">Back to lobby</a>
            <button class="btn" data-action="replay" type="button">Replay arena</button>
          </div>
        </section>
      `;
    }

    const arena = ARENAS[state.index];
    const result = currentEval();
    const fb = state.locked;
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Duel ${state.index + 1} / ${ARENAS.length}</p>
          <h1 class="page-title">${escapeHtml(arena.title)}</h1>
          <p class="muted">${escapeHtml(arena.blurb)}</p>
        </div>
        <p class="faint">Score ${state.score}</p>
      </div>
      <div class="sim-grid">
        <section class="panel">
          ${chart(result)}
          <div class="legend">
            <span><i class="swatch" style="background:#3ecfb2"></i>Train</span>
            <span><i class="swatch" style="background:#b39bff"></i>Validation</span>
            <span><i class="swatch" style="background:#f0b429"></i>Model</span>
          </div>
          <p class="faint" data-fit-stats>Train MSE ${result.trainMse.toFixed(3)} · Val MSE ${result.valMse.toFixed(3)} · gap ${(result.gap).toFixed(3)} · target val ≤ ${arena.targetVal}</p>
        </section>
        <section class="panel">
          <div class="control">
            <label for="degree" data-degree-label>Capacity (degree ${state.degree})</label>
            <input id="degree" data-slider="degree" type="range" min="1" max="11" step="1" value="${state.degree}" ${fb ? "disabled" : ""}/>
          </div>
          <div class="control">
            <label for="lambda" data-lambda-label>Ridge λ (${state.lambda.toFixed(2)})</label>
            <input id="lambda" data-slider="lambda" type="range" min="0" max="1.5" step="0.01" value="${state.lambda}" ${fb ? "disabled" : ""}/>
          </div>
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${fb.label}.</strong> Holdout MSE ${result.valMse.toFixed(3)} vs target ${arena.targetVal}.</p></div>` : ""}
          <div class="actions">
            ${fb
              ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === ARENAS.length - 1 ? "Recap" : "Next duel"}</button>`
              : `<button class="btn btn-primary" data-action="lock" type="button">Lock this fit</button>`}
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
      state.degree = 3;
      state.lambda = 0.08;
      render();
    });
    listen( "input", "[data-slider=degree]", (e, target) => {
      state.degree = Number(target.value);
      refreshFit();
    });
    listen( "input", "[data-slider=lambda]", (e, target) => {
      state.lambda = Number(target.value);
      refreshFit();
    });
    listen( "click", "[data-action=lock]", () => {
      const arena = ARENAS[state.index];
      const result = currentEval();
      state.locked = gradeArena(result.valMse, arena.targetVal);
      state.score += state.locked.points;
      state.recap.push(arena.blurb);
      render();
    });
    listen( "click", "[data-action=next]", () => {
      if (state.index >= ARENAS.length - 1) {
        state.phase = "recap";
      } else {
        state.index += 1;
        state.locked = null;
        state.degree = 3;
        state.lambda = 0.08;
      }
      render();
    });
  }

  overfittingPage.teardown = () => ac.abort();
  render();
}
