import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { METHODS, RACES, buildPopulation, takeSample, meanOf, gradeMethod } from "./engine.js";
import { starsFromRatio } from "../boosting/recommend.js";

function field(pop, sample) {
  const w = 640;
  const h = 240;
  const sampleSet = new Set(sample);
  const dots = pop
    .map((p, i) => {
      const x = 16 + (i % 40) * 15.4;
      const y = 16 + Math.floor(i / 40) * 22;
      const selected = sampleSet.has(p);
      const fill = selected ? "#f0b429" : "#2b3648";
      return `<circle cx="${x}" cy="${y}" r="${selected ? 4.2 : 3.2}" fill="${fill}"/>`;
    })
    .join("");
  return `<svg class="dot-field" viewBox="0 0 ${w} ${h}" role="img" aria-label="Population dots with sampled units highlighted">${dots}</svg>`;
}

export function samplingPage(root) {
  let bound = false;
  const ac = new AbortController();
  const state = {
    phase: "intro",
    index: 0,
    method: "srs",
    locked: null,
    score: 0,
    recap: [],
  };

  function snapshot() {
    const race = RACES[state.index];
    const pop = buildPopulation(race, 400, 11 + state.index);
    const sample = takeSample(pop, state.method, 48, 29 + state.index);
    return { race, pop, sample, estimate: meanOf(sample) };
  }

  function render() {
    mount(root, layout({ title: "Sampling Bias Race", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 3 · 8 bias races</p>
          <h1 class="page-title">Sampling Bias Race</h1>
          <p class="lede">Every estimate is a sample in costume. Pick a design, watch the highlighted units, and see how far the sample mean runs from the truth.</p>
          <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Start the first race</button></div>
        </section>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / (RACES.length * 3));
      saveGame("sampling", {
        score: state.score,
        bestScore: state.score,
        stars,
        completed: true,
        recap: state.recap,
      });
      return `
        <section class="recap">
          <p class="eyebrow">What you learned</p>
          <h2>The frame is the result</h2>
          <p>Score <strong>${state.score}</strong> / ${RACES.length * 3} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
          <ul class="learn-list">
            ${[...new Set(state.recap)].map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            <li>Convenience, voluntary response, survivorship, and recency are four costumes of the same bug: selection correlated with the outcome.</li>
          </ul>
          <div class="actions">
            <a class="btn btn-primary" href="#/">Back to lobby</a>
            <button class="btn" data-action="replay" type="button">Replay races</button>
          </div>
        </section>
      `;
    }

    const { race, pop, sample, estimate } = snapshot();
    const err = estimate - race.trueMean;
    const fb = state.locked;
    return `
      <div class="game-head">
        <div>
          <p class="eyebrow">Race ${state.index + 1} / ${RACES.length}</p>
          <h1 class="page-title">${escapeHtml(race.title)}</h1>
        </div>
        <p class="faint">Score ${state.score}</p>
      </div>
      <div class="sim-grid">
        <section class="panel">
          <p>${escapeHtml(race.setup)}</p>
          ${field(pop, sample)}
          <p class="faint">True mean ${race.trueMean} · sample mean ${estimate.toFixed(3)} · error ${err >= 0 ? "+" : ""}${err.toFixed(3)}</p>
        </section>
        <section class="panel">
          <div class="choice-grid" role="group" aria-label="Sampling method">
            ${Object.entries(METHODS)
              .map(
                ([id, meta]) => `
                <button class="choice" type="button" data-method="${id}" aria-pressed="${state.method === id}">
                  <strong>${escapeHtml(meta.name)}</strong>
                  <div class="faint">${escapeHtml(meta.blurb)}</div>
                </button>`,
              )
              .join("")}
          </div>
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${fb.label}.</strong> ${escapeHtml(race.learned)}</p></div>` : ""}
          <div class="actions">
            ${fb
              ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === RACES.length - 1 ? "Recap" : "Next race"}</button>`
              : `<button class="btn btn-primary" data-action="lock" type="button">Lock method</button>`}
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
      state.method = "srs";
      render();
    });
    listen("click", "[data-method]", (e, target) => {
      if (state.locked) return;
      state.method = target.getAttribute("data-method");
      render();
    });
    listen("click", "[data-action=lock]", () => {
      const race = RACES[state.index];
      state.locked = gradeMethod(race, state.method);
      state.score += state.locked.points;
      state.recap.push(race.learned);
      render();
    });
    listen("click", "[data-action=next]", () => {
      if (state.index >= RACES.length - 1) state.phase = "recap";
      else {
        state.index += 1;
        state.locked = null;
        state.method = "srs";
      }
      render();
    });
  }

  samplingPage.teardown = () => ac.abort();
  render();
}
