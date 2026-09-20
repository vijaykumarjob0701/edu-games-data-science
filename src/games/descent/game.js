import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { starsFromRatio } from "../boosting/recommend.js";
import { meter, scatterSurface } from "../_shared/plot.js";
import { CHALLENGES, SURFACES, contourGrid, diagnoseRun, gradeDescent, runDescent } from "./engine.js";

const MAX = CHALLENGES.length * 3;

export function descentPage(root) {
  let bound = false;
  const ac = new AbortController();
  let raf = 0;
  const state = {
    phase: "intro",
    index: 0,
    lr: 0.15,
    momentum: 0,
    steps: 40,
    frame: 0,
    playing: false,
    run: null,
    locked: null,
    pick: null,
    score: 0,
    recap: [],
  };

  function surfaceId() {
    return CHALLENGES[state.index].surface;
  }

  function recompute() {
    const ch = CHALLENGES[state.index];
    const steps = ch.maxSteps || state.steps;
    state.run = runDescent(surfaceId(), {
      lr: state.lr,
      momentum: state.momentum,
      steps,
      start: SURFACES[surfaceId()].start,
    });
    state.frame = 0;
    state.playing = false;
  }

  function stopPlay() {
    state.playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick() {
    if (!state.playing || !state.run) return;
    state.frame = Math.min(state.frame + 1, state.run.path.length - 1);
    paint();
    if (state.frame >= state.run.path.length - 1) {
      stopPlay();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function paint() {
    const svgHost = root.querySelector("[data-contour]");
    const stats = root.querySelector("[data-gd-stats]");
    const diag = root.querySelector("[data-gd-diag]");
    if (!svgHost || !state.run) return;
    const grid = contourGrid(surfaceId());
    const shown = state.run.path.slice(0, state.frame + 1);
    svgHost.innerHTML = scatterSurface({
      grid: { ...grid, valueKey: "z" },
      path: shown,
      lo: grid.lo,
      hi: grid.hi,
      label: "Loss surface and descent path",
    });
    const last = shown.at(-1);
    if (stats && last) {
      stats.textContent = `step ${state.frame} · x ${last.x.toFixed(2)} · y ${last.y.toFixed(2)} · loss ${last.loss.toFixed(4)}`;
    }
    if (diag) diag.textContent = `Diagnosis: ${diagnoseRun({ ...state.run, path: shown })}`;
  }

  function render() {
    mount(root, layout({ title: "Gradient Descent Playground", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
    if (state.phase === "play") paint();
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 6 · 5 step-size trials</p>
          <h1 class="page-title">Gradient Descent Playground</h1>
          <p class="lede">Pick a learning rate (and optional momentum). Watch the amber path on the contour. Too large: the iterate explodes. Too small: it crawls. Just right: the floor in a few dozen steps.</p>
          <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Drop into the bowl</button></div>
        </section>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / MAX);
      saveGame("descent", { score: state.score, bestScore: state.score, stars, completed: true, recap: state.recap });
      return `
        <section class="recap">
          <p class="eyebrow">What you learned</p>
          <h2>Step size is a hyperparameter with a failure mode</h2>
          <p>Score <strong>${state.score}</strong> / ${MAX} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
          <ul class="learn-list">
            ${[...new Set(state.recap)].map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            <li>Exploding step size: |1 − ηλ| &gt; 1. Vanishing step size: η‖∇f‖ is tiny. Same family of bugs as exploding / vanishing gradients, without a network.</li>
          </ul>
          <div class="actions">
            <a class="btn btn-primary" href="#/">Back to lobby</a>
            <button class="btn" data-action="replay" type="button">Replay</button>
          </div>
        </section>
      `;
    }

    const ch = CHALLENGES[state.index];
    const surf = SURFACES[surfaceId()];
    const fb = state.locked;
    if (!state.run) recompute();
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Trial ${state.index + 1} / ${CHALLENGES.length} · ${escapeHtml(surf.title)}</p>
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
          <div data-contour></div>
          <p class="faint" data-gd-stats>step 0</p>
          <p class="faint" data-gd-diag></p>
        </section>
        <section class="panel">
          <p class="muted">${escapeHtml(surf.blurb)}</p>
          <div class="control">
            <label for="gd-lr">Learning rate η (${state.lr.toFixed(3)})</label>
            <input id="gd-lr" data-knob="lr" type="range" min="0.001" max="2.5" step="0.001" value="${state.lr}" ${fb ? "disabled" : ""}/>
          </div>
          <div class="control">
            <label for="gd-m">Momentum (${state.momentum.toFixed(2)})</label>
            <input id="gd-m" data-knob="momentum" type="range" min="0" max="0.95" step="0.05" value="${state.momentum}" ${fb ? "disabled" : ""}/>
          </div>
          ${
            ch.type === "pick"
              ? `<div class="choice-grid">${ch.options
                  .map(
                    (opt) => `
                <button class="choice" type="button" data-pick="${opt.id}" aria-pressed="${state.pick === opt.id}" ${fb ? "disabled" : ""}>
                  <strong>${escapeHtml(opt.name)}</strong>
                  <div class="faint">${escapeHtml(opt.blurb || "")}</div>
                </button>`,
                  )
                  .join("")}</div>`
              : `<p class="faint">Target loss ≤ ${ch.targetLoss} within ${ch.maxSteps} steps.</p>`
          }
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${escapeHtml(fb.label)}.</strong> ${escapeHtml(ch.learned)}</p></div>` : ""}
          <div class="actions">
            ${
              fb
                ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === CHALLENGES.length - 1 ? "Recap" : "Next trial"}</button>`
                : `<button class="btn" data-action="reset-path" type="button">Recompute path</button>
                   <button class="btn" data-action="step" type="button">Step</button>
                   <button class="btn" data-action="play" type="button">${state.playing ? "Pause" : "Play"}</button>
                   <button class="btn btn-primary" data-action="lock" type="button">Lock in</button>`
            }
          </div>
        </section>
      </div>
    `;
  }

  function bind(signal) {
    const listen = (type, sel, fn) => on(root, type, sel, fn, signal);
    listen("click", "[data-action=start], [data-action=replay]", (e, target) => {
      stopPlay();
      if (target.getAttribute("data-action") === "replay") {
        state.index = 0;
        state.score = 0;
        state.recap = [];
        state.lr = 0.15;
        state.momentum = 0;
      }
      state.phase = "play";
      state.locked = null;
      state.pick = null;
      recompute();
      render();
    });
    listen("input", "[data-knob]", (e, target) => {
      if (state.locked) return;
      const key = target.getAttribute("data-knob");
      state[key] = Number(target.value);
      const lrLab = root.querySelector("label[for=gd-lr]");
      const mLab = root.querySelector("label[for=gd-m]");
      if (lrLab) lrLab.textContent = `Learning rate η (${state.lr.toFixed(3)})`;
      if (mLab) mLab.textContent = `Momentum (${state.momentum.toFixed(2)})`;
    });
    listen("change", "[data-knob]", () => {
      if (state.locked) return;
      stopPlay();
      recompute();
      paint();
    });
    listen("click", "[data-action=reset-path]", () => {
      stopPlay();
      recompute();
      paint();
    });
    listen("click", "[data-action=step]", () => {
      if (!state.run) recompute();
      stopPlay();
      state.frame = Math.min(state.frame + 1, state.run.path.length - 1);
      paint();
    });
    listen("click", "[data-action=play]", () => {
      if (!state.run) recompute();
      if (state.playing) {
        stopPlay();
        const btn = root.querySelector("[data-action=play]");
        if (btn) btn.textContent = "Play";
        return;
      }
      if (state.frame >= state.run.path.length - 1) state.frame = 0;
      state.playing = true;
      const btn = root.querySelector("[data-action=play]");
      if (btn) btn.textContent = "Pause";
      tick();
    });
    listen("click", "[data-pick]", (e, target) => {
      if (state.locked) return;
      state.pick = target.getAttribute("data-pick");
      render();
    });
    listen("click", "[data-action=lock]", () => {
      const ch = CHALLENGES[state.index];
      if (ch.type === "pick") {
        if (!state.pick) return;
        state.locked = gradeDescent(ch, state.pick);
      } else {
        if (!state.run) recompute();
        state.locked = gradeDescent(ch, state.run);
      }
      stopPlay();
      state.score += state.locked.points;
      state.recap.push(ch.learned);
      render();
    });
    listen("click", "[data-action=next]", () => {
      stopPlay();
      if (state.index >= CHALLENGES.length - 1) state.phase = "recap";
      else {
        state.index += 1;
        state.locked = null;
        state.pick = null;
        if (CHALLENGES[state.index].id === "valley-run") {
          state.lr = 0.08;
          state.momentum = 0.6;
        }
        recompute();
      }
      render();
    });
  }

  descentPage.teardown = () => {
    stopPlay();
    ac.abort();
  };
  render();
}
