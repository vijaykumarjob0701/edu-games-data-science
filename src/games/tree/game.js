import { layout, mount, on, escapeHtml } from "../../ui.js";
import { saveGame } from "../../progress.js";
import { starsFromRatio } from "../boosting/recommend.js";
import { meter, scatterSurface } from "../_shared/plot.js";
import {
  CHALLENGES,
  DATASETS,
  applyManualSplit,
  gradeTree,
  growTree,
  makePoints,
  partitions,
  treeAccuracy,
  treeDepth,
} from "./engine.js";

const MAX = CHALLENGES.length * 3;

export function treePage(root) {
  let bound = false;
  const ac = new AbortController();
  const cache = {};
  const state = {
    phase: "intro",
    index: 0,
    maxDepth: 2,
    criterion: "gini",
    feature: "x",
    threshold: 0,
    mode: "auto",
    tree: null,
    locked: null,
    pick: null,
    score: 0,
    recap: [],
  };

  function data() {
    const id = CHALLENGES[state.index].dataset;
    if (!cache[id]) {
      cache[id] = {
        train: makePoints(id, 70, 5),
        val: makePoints(id, 70, 41),
      };
    }
    return cache[id];
  }

  function grow() {
    const { train } = data();
    if (state.mode === "manual") {
      state.tree = applyManualSplit(train, state.feature, state.threshold);
    } else {
      state.tree = growTree(train, { maxDepth: state.maxDepth, minLeaf: 2, criterion: state.criterion });
    }
  }

  function render() {
    mount(root, layout({ title: "Decision Tree Builder", body: body() }));
    if (!bound) {
      bind(ac.signal);
      bound = true;
    }
  }

  function treeText(node, indent = "") {
    if (!node) return "";
    if (node.type === "leaf") return `${indent}leaf → class ${node.label} (n=${node.n})\n`;
    return `${indent}${node.feature} ≤ ${node.threshold.toFixed(2)}\n${treeText(node.left, `${indent}  `)}${treeText(node.right, `${indent}  `)}`;
  }

  function body() {
    if (state.phase === "intro") {
      return `
        <section class="instructions">
          <p class="eyebrow">Game 8 · 5 split trials</p>
          <h1 class="page-title">Decision Tree Builder</h1>
          <p class="lede">Grow axis-aligned partitions on 2D toys. Let Gini or entropy pick the cut, or place one yourself. A shallow tree beats a dummy baseline; a deep tree on noisy labels memorizes the flips.</p>
          <div class="actions"><button class="btn btn-primary" data-action="start" type="button">Plant the first stump</button></div>
        </section>
      `;
    }
    if (state.phase === "recap") {
      const stars = starsFromRatio(state.score / MAX);
      saveGame("tree", { score: state.score, bestScore: state.score, stars, completed: true, recap: state.recap });
      return `
        <section class="recap">
          <p class="eyebrow">What you learned</p>
          <h2>Depth is capacity. Impurity is the compass.</h2>
          <p>Score <strong>${state.score}</strong> / ${MAX} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</p>
          <ul class="learn-list">
            ${[...new Set(state.recap)].map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            <li>Pruning / max-depth is regularization for trees. Train purity is not the goal.</li>
          </ul>
          <div class="actions">
            <a class="btn btn-primary" href="#/">Back to lobby</a>
            <button class="btn" data-action="replay" type="button">Replay</button>
          </div>
        </section>
      `;
    }

    const ch = CHALLENGES[state.index];
    if (!state.tree) grow();
    const { train, val } = data();
    const parts = partitions(state.tree);
    const trainAcc = treeAccuracy(state.tree, train);
    const valAcc = treeAccuracy(state.tree, val);
    const depth = treeDepth(state.tree);
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
          <p class="faint">Score ${state.score}</p>
        </div>
      </div>
      <div class="sim-grid">
        <section class="panel">
          ${scatterSurface({ points: train, partitions: parts, label: "Tree partitions on training points" })}
          <p class="faint">Depth ${depth} · train ${(trainAcc * 100).toFixed(0)}% · val ${(valAcc * 100).toFixed(0)}%</p>
          <pre class="tree-view">${escapeHtml(treeText(state.tree).trim())}</pre>
        </section>
        <section class="panel">
          <div class="choice-grid" role="group" aria-label="Grow mode">
            <button class="choice" type="button" data-mode="auto" aria-pressed="${state.mode === "auto"}" ${fb ? "disabled" : ""}>Impurity grows the tree</button>
            <button class="choice" type="button" data-mode="manual" aria-pressed="${state.mode === "manual"}" ${fb ? "disabled" : ""}>I pick one split</button>
          </div>
          <div class="choice-grid" style="margin-top:10px">
            <button class="choice" type="button" data-crit="gini" aria-pressed="${state.criterion === "gini"}" ${fb ? "disabled" : ""}>Gini</button>
            <button class="choice" type="button" data-crit="entropy" aria-pressed="${state.criterion === "entropy"}" ${fb ? "disabled" : ""}>Entropy</button>
          </div>
          ${
            state.mode === "auto"
              ? `<div class="control"><label for="tree-d">Max depth (${state.maxDepth})</label>
                 <input id="tree-d" data-depth type="range" min="1" max="8" step="1" value="${state.maxDepth}" ${fb ? "disabled" : ""}/></div>`
              : `<div class="choice-grid">
                   <button class="choice" type="button" data-feat="x" aria-pressed="${state.feature === "x"}" ${fb ? "disabled" : ""}>Split on x</button>
                   <button class="choice" type="button" data-feat="y" aria-pressed="${state.feature === "y"}" ${fb ? "disabled" : ""}>Split on y</button>
                 </div>
                 <div class="control"><label for="tree-t">Threshold (${state.threshold.toFixed(2)})</label>
                 <input id="tree-t" data-thr type="range" min="-2" max="2" step="0.05" value="${state.threshold}" ${fb ? "disabled" : ""}/></div>`
          }
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
              : `<p class="faint">${ch.maxDepth != null ? `Stay at depth ≤ ${ch.maxDepth}. ` : ""}${ch.minDepth != null ? `Need depth ≥ ${ch.minDepth}. ` : ""}Target train acc ≥ ${(ch.targetAcc * 100).toFixed(0)}%.</p>`
          }
          ${fb ? `<div class="feedback ${fb.points >= 2 ? "good" : fb.points === 1 ? "ok" : "bad"}" role="status"><p><strong>${escapeHtml(fb.label)}.</strong> ${escapeHtml(ch.learned)}</p></div>` : ""}
          <div class="actions">
            ${
              fb
                ? `<button class="btn btn-primary" data-action="next" type="button">${state.index === CHALLENGES.length - 1 ? "Recap" : "Next trial"}</button>`
                : `<button class="btn" data-action="regrow" type="button">Regrow</button>
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
      state.maxDepth = 2;
      state.mode = "auto";
      grow();
      render();
    });
    listen("click", "[data-mode]", (e, target) => {
      if (state.locked) return;
      state.mode = target.getAttribute("data-mode");
      grow();
      render();
    });
    listen("click", "[data-crit]", (e, target) => {
      if (state.locked) return;
      state.criterion = target.getAttribute("data-crit");
      grow();
      render();
    });
    listen("click", "[data-feat]", (e, target) => {
      if (state.locked) return;
      state.feature = target.getAttribute("data-feat");
      grow();
      render();
    });
    listen("input", "[data-depth]", (e, target) => {
      state.maxDepth = Number(target.value);
      grow();
      render();
    });
    listen("input", "[data-thr]", (e, target) => {
      state.threshold = Number(target.value);
      grow();
      render();
    });
    listen("click", "[data-pick]", (e, target) => {
      if (state.locked) return;
      state.pick = target.getAttribute("data-pick");
      render();
    });
    listen("click", "[data-action=regrow]", () => {
      grow();
      render();
    });
    listen("click", "[data-action=lock]", () => {
      const ch = CHALLENGES[state.index];
      if (ch.type === "pick") {
        if (!state.pick) return;
        state.locked = gradeTree(ch, state.pick);
      } else {
        const { train } = data();
        state.locked = gradeTree(ch, { depth: treeDepth(state.tree), acc: treeAccuracy(state.tree, train) });
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
        const next = CHALLENGES[state.index];
        if (next.id === "xor-depth") state.maxDepth = 3;
        if (next.id === "overfit") state.maxDepth = 8;
        grow();
      }
      render();
    });
  }

  treePage.teardown = () => ac.abort();
  render();
}
