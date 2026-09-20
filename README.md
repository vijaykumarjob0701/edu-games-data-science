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
cp .env.example .env
```

Set `SITE_PASSWORD` in `.env` (local only; never commit `.env`). Then:

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). You should see the unlock page first. After a correct password, the lobby loads.

```bash
npm test        # unit tests for scoring / session helpers
npm run build   # production bundle into dist/
npm run preview # serve dist with the same password gate
```

The Vite dev/preview servers implement `/api/auth` and redirect unauthenticated HTML requests to `/gate.html`, matching production closely. They do **not** hard-block JS bundles the way the Netlify Edge Function does.

## Netlify deploy

1. Import this repo in Netlify (or `netlify init` from the CLI).
2. Build settings are in `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Site settings → **Environment variables** → add `SITE_PASSWORD` with the classroom password. Do not put the password in the repo, `netlify.toml`, or README.
4. Deploy. The Edge Function `gate` runs on `/*`. Unauthenticated visitors are sent to `/gate.html`. `POST /api/auth` (proxied to the `auth` function) checks `SITE_PASSWORD` and sets an `HttpOnly` session cookie.

Without `SITE_PASSWORD`, unlock returns an error and the lab stays gated.

### How the password gate works

- The password exists only as the Netlify (or local `.env`) environment variable `SITE_PASSWORD`.
- `netlify/functions/auth.js` verifies the password and sets a signed session cookie.
- `netlify/edge-functions/gate.js` allows `/gate.html` and `/api/auth` without a cookie, and blocks the rest of the site (including JS bundles) until the cookie is valid.
- The frontend never embeds the password.

## Stack

Vite (vanilla JS), static `dist/` publish, one Netlify Function, one Edge Function.
