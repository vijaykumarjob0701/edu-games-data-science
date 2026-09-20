function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function sx(x, lo, hi, w) {
  return ((x - lo) / (hi - lo)) * w;
}

export function sy(y, lo, hi, h) {
  return h - ((y - lo) / (hi - lo)) * h;
}

function lerpColor(t) {
  const u = clamp(t, 0, 1);
  const a = [62, 207, 178];
  const b = [255, 122, 89];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function scatterSurface({
  points = [],
  grid = null,
  partitions = null,
  path = null,
  cursor = null,
  w = 640,
  h = 300,
  lo = -2.6,
  hi = 2.6,
  label = "2D toy data",
  valueKey = "v",
} = {}) {
  const toX = (x) => sx(x, lo, hi, w);
  const toY = (y) => sy(y, lo, hi, h);
  let heat = "";
  if (grid) {
    const n = grid.n;
    const cw = w / n;
    const ch = h / n;
    const min = grid.min ?? 0;
    const max = grid.max ?? 1;
    heat = grid.cells
      .map((c) => {
        const raw = c[valueKey] ?? c.v ?? c.z;
        let t;
        if (grid.max != null) t = (raw - min) / (max - min + 1e-9);
        else t = clamp(raw, 0, 1);
        const gx = toX(c.x) - cw / 2;
        const gy = toY(c.y) - ch / 2;
        return `<rect x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${cw + 0.4}" height="${ch + 0.4}" fill="${lerpColor(t)}" opacity="0.35"/>`;
      })
      .join("");
  }
  let parts = "";
  if (partitions) {
    parts = partitions
      .map((p) => {
        const x = toX(p.x0);
        const y = toY(p.y1);
        const ww = Math.max(0, toX(p.x1) - toX(p.x0));
        const hh = Math.max(0, toY(p.y0) - toY(p.y1));
        const fill = p.label === 1 ? "rgba(255,122,89,0.18)" : "rgba(62,207,178,0.18)";
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${ww.toFixed(1)}" height="${hh.toFixed(1)}" fill="${fill}" stroke="#2b3648" stroke-width="0.6"/>`;
      })
      .join("");
  }
  const dots = points
    .map((p) => {
      const fill = p.label >= 0.5 ? "#ff7a59" : "#3ecfb2";
      return `<circle cx="${toX(p.x).toFixed(1)}" cy="${toY(p.y).toFixed(1)}" r="3.3" fill="${fill}" opacity="0.9"/>`;
    })
    .join("");
  let trail = "";
  if (path && path.length) {
    const d = path
      .map((p, i) => `${i ? "L" : "M"}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`)
      .join(" ");
    trail = `<path d="${d}" fill="none" stroke="#f0b429" stroke-width="2.2"/>`;
    const last = path.at(-1);
    trail += `<circle cx="${toX(last.x).toFixed(1)}" cy="${toY(last.y).toFixed(1)}" r="5" fill="#f0b429"/>`;
  }
  const mark = cursor
    ? `<circle cx="${toX(cursor.x).toFixed(1)}" cy="${toY(cursor.y).toFixed(1)}" r="6" fill="none" stroke="#e9eef6" stroke-width="2"/>`
    : "";
  return `
    <svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
      <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
      ${heat}${parts}${trail}${dots}${mark}
    </svg>
  `;
}

export function meter(done, total) {
  const pct = Math.round((done / Math.max(1, total)) * 100);
  return `
    <div class="progress-meter">
      <div class="faint">${done} / ${total} locked in</div>
      <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
    </div>
  `;
}
