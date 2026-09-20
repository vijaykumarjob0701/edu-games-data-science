# Split Lab — educational games for data science

Interactive, static labs for university and bootcamp students covering gradient boosting libraries, overfitting, and sampling bias. Built to deploy on Netlify.

## Games

1. **Boosting Showdown** (featured) — 12 client briefs plus a live tradeoff lab. Covers CatBoost categoricals and ordered boosting, LightGBM leaf-wise vs XGBoost level-wise trees, regularization/ecosystem, missing values, sparse data, size/speed budgets, and GPU myths vs reality.
2. **Overfitting Arena** — fit noisy curves against a holdout. Capacity and ridge are the only knobs; validation error is the score.
3. **Sampling Bias Race** — pick a sampling design and watch the estimate miss the population mean (convenience, voluntary response, survivorship, recency).

Progress (stars and best scores) is stored in `localStorage` in this browser.

## Local development

Requirements: Node 20+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The lobby loads immediately — the site is public.

```bash
npm test        # unit tests for scoring helpers
npm run build   # production bundle into dist/
npm run preview # serve dist locally
```

## Netlify deploy

1. Import this repo in Netlify (or `netlify init` from the CLI).
2. Build settings are in `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Deploy. The lab is a static site with no login wall.

## Stack

Vite (vanilla JS) with a static `dist/` publish directory.
