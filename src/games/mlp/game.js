import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { starsFromRatio } from "../boosting/recommend.js";
import { meter, scatterSurface } from "../_shared/plot.js";
import {
  CHALLENGES,
  DATASETS,
  decisionGrid,
  forwardActivations,
  gradeMlpChallenge,
  initNet,
  makePoints,
  mlpAccuracy,
  trainNet,
} from "./engine.js";

const MAX = CHALLENGES.length * 3;

export function mlpPage(root) {
  let bound = false;
  const ac = new AbortController();
  const cache = {};
  const state = {
    phase: "intro",
    index: 0,
    hidden: 1,
    width: 6,
    activation: "relu",
    lr: 0.35,
    epochs: 500,
    net: null,
    locked: null,
    pick: null,
    score: 0,
    recap: [],
    probe: { x: 0.8, y: -0.6 },
  };

  function pts() {
    const id = CHALLENGES[state.index].dataset;
    if (!cache[id]) cache[id] = makePoints(id, 90, 2);
    return cache[id];
  }

  function ensureNet() {
    if (!state.net) {
      state.net = initNet({
        hidden: state.hidden,
        width: state.width,
        activation: state.activation,
        seed: 7,
      });
    }
    return state.net;
  }

  function rebuild() {
    state.net = initNet({
      hidden: state.hidden,
      width: state.width,
      activation: state.activation,
      seed: 7 + state.index,
    });
  }

  function render() {
    mount(root, layout({ title: "MLP Lab", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 5 · 4 capacity trials</p>
          <h1 class="page-title">MLP Lab</h1>
          <p class="lede">A multi-layer perceptron is just stacked linear maps with a nonlinearity in between. Change depth, width, and activation, train, and watch the 0.5 contour fold around XOR, moons, and rings.</p>
        </section>
        <div class="scenario">
          <article class="brief">
            <h2>How to play</h2>
            <ol>
              <li>Pick hidden layers (0–2), width, and ReLU / sigmoid / tanh / linear.</li>
              <li>Train. The heat is P(class = 1). The probe point shows a forward pass.</li>
              <li>Lock when accuracy clears the challenge — or answer the linear-activation brief.</li>
            </ol>
            <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Open the lab</button></div>
          </article>
          <aside class="panel">
            <p class="eyebrow">Capacity vs shape</p>
            <p>Zero hidden layers = logistic / perceptron. Linear hidden activations collapse back to that. Width and ReLU/tanh are how XOR becomes easy.</p>
          </aside>
        </div>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / MAX);
      saveGame("mlp", { score: state.score, bestScore: state.score, stars, completed: true, recap: state.recap });
      return `
        <section class="recap">
          <p class="eyebrow">What you learned</p>
          <h2>Nonlinearity is the whole trick</h2>
          <p>Score <strong>${state.score}</strong> / ${MAX} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
          <ul class="learn-list">
            ${[...new Set(state.recap)].map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            <li>Width × depth is capacity. Without a bend in the activation, extra layers do not add new functions.</li>
          </ul>
          <div class="actions">
            <a class="btn btn-primary" href="#/">Back to lobby</a>
            <button class="btn" data-action="replay" type="button">Replay lab</button>
          </div>
        </section>
      `;
    }

    const ch = CHALLENGES[state.index];
    const net = ensureNet();
    const points = pts();
    const acc = mlpAccuracy(net, points);
    const grid = decisionGrid(net);
    const trace = forwardActivations(net, state.probe.x, state.probe.y);
    const ds = DATASETS.find((d) => d.id === ch.dataset);
    const fb = state.locked;
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Trial ${state.index + 1} / ${CHALLENGES.length} · ${escapeHtml(ds.title)}</p>
          <h1 class="page-title">${escapeHtml(ch.title)}</h1>
          <p class="muted">${escapeHtml(ch.prompt)}</p>
        </div>
        <div>
          ${meter(state.index + (fb ? 1 : 0), CHALLENGES.length)}
          <p class="faint">Score ${state.score} · acc ${(acc * 100).toFixed(0)}%</p>
        </div>
      </div>
      <div class="sim-grid">
        <section class="panel">
          ${scatterSurface({ points, grid, cursor: state.probe, label: "MLP decision surface" })}
          <p class="faint">Forward probe (${state.probe.x.toFixed(1)}, ${state.probe.y.toFixed(1)}) → ŷ = ${trace.output.toFixed(3)}</p>
          <div class="net-trace">
            ${trace.layers
              .map(
                (layer) => `
              <div class="trace-row">
                <span class="chip">${escapeHtml(layer.name)}</span>
                <span class="faint">${layer.a.map((v) => v.toFixed(2)).join(" · ")}</span>
              </div>`,
              )
              .join("")}
          </div>
        </section>
        <section class="panel">
          <div class="control">
            <label for="mlp-h">Hidden layers (${state.hidden})</label>
            <input id="mlp-h" data-arch="hidden" type="range" min="0" max="2" step="1" value="${state.hidden}" ${fb ? "disabled" : ""}/>
          </div>
          <div class="control">
            <label for="mlp-w">Width (${state.width})</label>
            <input id="mlp-w" data-arch="width" type="range" min="1" max="8" step="1" value="${state.width}" ${fb ? "disabled" : ""}/>
          </div>
          <div class="choice-grid" role="group" aria-label="Activation">
            ${["relu", "tanh", "sigmoid", "linear"]
              .map(
                (a) => `
              <button class="choice" type="button" data-act="${a}" aria-pressed="${state.activation === a}" ${fb ? "disabled" : ""}>${a}</button>`,
              )
              .join("")}
          </div>
          <div class="control">
            <label for="mlp-lr">Learning rate (${state.lr.toFixed(2)})</label>
            <input id="mlp-lr" data-knob="lr" type="range" min="0.05" max="0.8" step="0.05" value="${state.lr}" ${fb ? "disabled" : ""}/>
          </div>
          ${
            ch.type === "pick"
              ? `<div class="choice-grid" style="margin-top:12px">${ch.options
                  .map(
                    (opt) => `
                <button class="choice" type="button" data-pick="${opt.id}" aria-pressed="${state.pick === opt.id}" ${fb ? "disabled" : ""}>
                  <strong>${escapeHtml(opt.name)}</strong>
                  <div class="faint">${escapeHtml(opt.blurb || "")}</div>
                </button>`,
                  )
                  .join("")}</div>`
              : `<p class="faint">Target ≥ ${(ch.targetAcc * 100).toFixed(0)}%. Train, then lock.</p>`
          }
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${escapeHtml(fb.label)}.</strong> ${escapeHtml(ch.learned)}</p></div>` : ""}
          <div class="actions">
            ${
              fb
                ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === CHALLENGES.length - 1 ? "Recap" : "Next trial"}</button>`
                : `${ch.type === "pick" ? "" : `<button class="btn" data-action="train" type="button">Train ${state.epochs} epochs</button>`}
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
      if (target.getAttribute("data-action") === "replay") {
        state.index = 0;
        state.score = 0;
        state.recap = [];
      }
      state.phase = "play";
      state.locked = null;
      state.pick = null;
      state.hidden = 1;
      state.width = 6;
      rebuild();
      render();
    });
    listen("input", "[data-arch]", (e, target) => {
      if (state.locked) return;
      const key = target.getAttribute("data-arch");
      state[key] = Number(target.value);
      rebuild();
      render();
    });
    listen("input", "[data-knob=lr]", (e, target) => {
      state.lr = Number(target.value);
      const label = root.querySelector("label[for=mlp-lr]");
      if (label) label.textContent = `Learning rate (${state.lr.toFixed(2)})`;
    });
    listen("click", "[data-act]", (e, target) => {
      if (state.locked) return;
      state.activation = target.getAttribute("data-act");
      rebuild();
      render();
    });
    listen("click", "[data-pick]", (e, target) => {
      if (state.locked) return;
      state.pick = target.getAttribute("data-pick");
      render();
    });
    listen("click", "[data-action=train]", () => {
      trainNet(ensureNet(), pts(), { lr: state.lr, epochs: state.epochs });
      render();
    });
    listen("click", "[data-action=lock]", () => {
      const ch = CHALLENGES[state.index];
      if (ch.type === "pick") {
        if (!state.pick) return;
        state.locked = gradeMlpChallenge(ch, state.pick);
      } else {
        const acc = mlpAccuracy(ensureNet(), pts());
        state.locked = gradeMlpChallenge(ch, {
          hidden: state.hidden,
          width: state.width,
          activation: state.activation,
          acc,
        });
      }
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
        rebuild();
      }
      render();
    });
  }

  mlpPage.teardown = () => ac.abort();
  render();
}
