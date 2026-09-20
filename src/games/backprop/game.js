import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { starsFromRatio } from "../boosting/recommend.js";
import { meter } from "../_shared/plot.js";
import {
  QUIZZES,
  demoNet,
  framesFor,
  gradeBackprop,
  layerGradNorms,
} from "./engine.js";

const MAX = QUIZZES.length * 3;
const DEMO_X = [0.8, -0.4];
const DEMO_Y = 1;

function netSvg(net, activations) {
  const w = 640;
  const h = 240;
  const layers = [2, ...net.layers.map((l) => l.W.length)];
  const xs = layers.map((_, i) => 70 + (i * (w - 140)) / Math.max(1, layers.length - 1));
  let edges = "";
  let nodes = "";
  for (let li = 0; li < net.layers.length; li += 1) {
    const lyr = net.layers[li];
    for (let j = 0; j < lyr.W.length; j += 1) {
      for (let k = 0; k < lyr.W[j].length; k += 1) {
        const x1 = xs[li];
        const x2 = xs[li + 1];
        const y1 = ((k + 1) / (layers[li] + 1)) * h;
        const y2 = ((j + 1) / (layers[li + 1] + 1)) * h;
        const mag = Math.min(1, Math.abs(lyr.W[j][k]) * 1.4);
        edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lyr.W[j][k] >= 0 ? "#3ecfb2" : "#ff7a59"}" stroke-width="${1 + mag * 2}" opacity="0.7"/>`;
      }
    }
  }
  layers.forEach((count, li) => {
    for (let i = 0; i < count; i += 1) {
      const cx = xs[li];
      const cy = ((i + 1) / (count + 1)) * h;
      const a = activations?.[li]?.[i];
      const fill = a == null ? "#1c2533" : `rgba(240,180,41,${0.25 + 0.7 * a})`;
      nodes += `<circle cx="${cx}" cy="${cy}" r="16" fill="${fill}" stroke="#e9eef4" stroke-width="1.4"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#e9eef4">${a == null ? "" : a.toFixed(2)}</text>`;
    }
  });
  return `<svg class="chart net-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tiny MLP 2-2-1">${edges}${nodes}</svg>`;
}

export function backpropPage(root) {
  let bound = false;
  const ac = new AbortController();
  const net = demoNet();
  const pack = framesFor(net, DEMO_X, DEMO_Y);
  const vanish = layerGradNorms({ depth: 5, width: 2, act: "sigmoid", scale: 0.25, seed: 2 });
  const state = {
    phase: "intro",
    index: 0,
    frame: 0,
    playing: false,
    locked: null,
    pick: null,
    score: 0,
    recap: [],
  };
  let timer = 0;

  function stop() {
    state.playing = false;
    if (timer) clearInterval(timer);
    timer = 0;
  }

  function optionsOf(q) {
    if (typeof q.options === "function") return q.options().map((id) => ({ id, name: id, blurb: "" }));
    return q.options;
  }

  function render() {
    mount(root, layout({ title: "Forward & Backprop", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 7 · 5 check beats on a 2→2→1 net</p>
          <h1 class="page-title">Forward &amp; Backprop</h1>
          <p class="lede">Step a single example through a tiny network: activations, loss, then gradients flowing backward into weights. Pause on a frame. Then predict which weight moves and spot a vanishing-gradient stack.</p>
          <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Step into the net</button></div>
        </section>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / MAX);
      saveGame("backprop", { score: state.score, bestScore: state.score, stars, completed: true, recap: state.recap });
      return `
        <section class="recap">
          <p class="eyebrow">What you learned</p>
          <h2>Forward is belief. Backward is blame.</h2>
          <p>Score <strong>${state.score}</strong> / ${MAX} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
          <ul class="learn-list">
            ${[...new Set(state.recap)].map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            <li>∂L/∂w = δ · a. Dead activations starve the update. Saturated sigmoids shrink δ.</li>
          </ul>
          <div class="actions">
            <a class="btn btn-primary" href="#/">Back to lobby</a>
            <button class="btn" data-action="replay" type="button">Replay</button>
          </div>
        </section>
      `;
    }

    const q = QUIZZES[state.index];
    const frame = pack.frames[Math.min(state.frame, pack.frames.length - 1)];
    const fb = state.locked;
    const maxV = Math.max(...vanish, 1e-9);
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Beat ${state.index + 1} / ${QUIZZES.length}</p>
          <h1 class="page-title">${escapeHtml(q.title)}</h1>
          <p class="muted">${escapeHtml(q.prompt)}</p>
        </div>
        <div>
          ${meter(state.index + (fb ? 1 : 0), QUIZZES.length)}
          <p class="faint">Score ${state.score}</p>
        </div>
      </div>
      <div class="sim-grid">
        <section class="panel">
          ${netSvg(net, pack.fwd.activations)}
          <p class="eyebrow">Frame ${state.frame + 1} / ${pack.frames.length} · ${escapeHtml(frame.title)}</p>
          <p>${escapeHtml(frame.detail)}</p>
          ${
            q.id === "vanish"
              ? `<div class="bars" style="margin-top:12px">${vanish
                  .map(
                    (v, i) => `
                <div>
                  <div class="faint">Layer ${i + 1} ‖∇W‖ ${v.toExponential(2)}</div>
                  <div class="bar-track"><span style="width:${Math.max(4, (100 * v) / maxV)}%;background:#b39bff"></span></div>
                </div>`,
                  )
                  .join("")}</div>`
              : ""
          }
          <div class="actions">
            <button class="btn" data-action="prev-frame" type="button">Back</button>
            <button class="btn" data-action="next-frame" type="button">Step</button>
            <button class="btn" data-action="play-frames" type="button">${state.playing ? "Pause" : "Play"}</button>
          </div>
        </section>
        <section class="panel">
          <div class="choice-grid">
            ${optionsOf(q)
              .map(
                (opt) => `
              <button class="choice" type="button" data-pick="${opt.id}" aria-pressed="${state.pick === opt.id}" ${fb ? "disabled" : ""}>
                <strong>${escapeHtml(opt.name)}</strong>
                <div class="faint">${escapeHtml(opt.blurb || "")}</div>
              </button>`,
              )
              .join("")}
          </div>
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${escapeHtml(fb.label)}.</strong> ${escapeHtml(q.learned)}</p></div>` : ""}
          <div class="actions">
            ${
              fb
                ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === QUIZZES.length - 1 ? "Recap" : "Next beat"}</button>`
                : `<button class="btn btn-primary" data-action="lock" type="button">Lock answer</button>`
            }
          </div>
        </section>
      </div>
    `;
  }

  function bind(signal) {
    const listen = (type, sel, fn) => on(root, type, sel, fn, signal);
    listen("click", "[data-action=start], [data-action=replay]", (e, target) => {
      stop();
      if (target.getAttribute("data-action") === "replay") {
        state.index = 0;
        state.score = 0;
        state.recap = [];
      }
      state.phase = "play";
      state.frame = 0;
      state.locked = null;
      state.pick = null;
      render();
    });
    listen("click", "[data-action=prev-frame]", () => {
      stop();
      state.frame = Math.max(0, state.frame - 1);
      render();
    });
    listen("click", "[data-action=next-frame]", () => {
      stop();
      state.frame = Math.min(pack.frames.length - 1, state.frame + 1);
      render();
    });
    listen("click", "[data-action=play-frames]", () => {
      if (state.playing) {
        stop();
        render();
        return;
      }
      state.playing = true;
      render();
      timer = setInterval(() => {
        if (state.frame >= pack.frames.length - 1) {
          stop();
          render();
          return;
        }
        state.frame += 1;
        render();
      }, 700);
    });
    listen("click", "[data-pick]", (e, target) => {
      if (state.locked) return;
      state.pick = target.getAttribute("data-pick");
      render();
    });
    listen("click", "[data-action=lock]", () => {
      const q = QUIZZES[state.index];
      if (!state.pick) return;
      state.locked = gradeBackprop(q, state.pick);
      state.score += state.locked.points;
      state.recap.push(q.learned);
      stop();
      render();
    });
    listen("click", "[data-action=next]", () => {
      stop();
      if (state.index >= QUIZZES.length - 1) state.phase = "recap";
      else {
        state.index += 1;
        state.locked = null;
        state.pick = null;
        state.frame = 0;
      }
      render();
    });
  }

  backpropPage.teardown = () => {
    stop();
    ac.abort();
  };
  render();
}
