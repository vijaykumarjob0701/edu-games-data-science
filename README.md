# Split Lab — educational games for data science

Interactive, static labs for university and bootcamp students covering gradient boosting libraries, overfitting, sampling bias, classic linear models, MLPs, gradient descent, backpropagation, and decision trees. Built to deploy on Netlify.

## Games

1. **Boosting Showdown** (featured) — 12 client briefs plus a live tradeoff lab. Covers CatBoost categoricals and ordered boosting, LightGBM leaf-wise vs XGBoost level-wise trees, regularization/ecosystem, missing values, sparse data, size/speed budgets, and GPU myths vs reality.
2. **Overfitting Arena** — fit noisy curves against a holdout. Capacity and ridge are the only knobs; validation error is the score.
3. **Sampling Bias Race** — pick a sampling design and watch the estimate miss the population mean (convenience, voluntary response, survivorship, recency).
4. **Linear vs Logistic vs Perceptron** — same 2D toys, three linear scores. See unbounded OLS on binary labels, logistic probabilities, and the perceptron stall on XOR.
5. **MLP Lab** — choose hidden layers, width, and ReLU / tanh / sigmoid; watch capacity and nonlinearity fold XOR, moons, and circles. Forward-pass activations on a probe point.
6. **Gradient Descent Playground** — contour surfaces, animated steps, learning rate and momentum. Too high diverges, too low crawls, just-right hits a loss bar.
7. **Forward & Backprop** — step a 2→2→1 net frame-by-frame (activations, loss, gradients), then quiz which weight moves and spot vanishing gradients.
8. **Decision Tree Builder** — grow or place axis-aligned splits with Gini or entropy, prune vs overfit, and beat a shallow-tree baseline.

Progress (stars and best scores) is stored in `localStorage` in this browser.

## Local development

Requirements: Node 20+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The lobby loads immediately — the site is public.

```bash
npm test        # unit tests for scoring helpers and game engines
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
