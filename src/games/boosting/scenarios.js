export const SCENARIOS = [
  {
    id: "merchant-cats",
    title: "The SKU jungle",
    topic: "Native categoricals",
    setup:
      "A payments team hands you 80k rows of fraud labels. Forty columns are categoricals: merchant, city, SKU, device family, bank BIN. Cardinality runs from 12 to 8,000. They currently one-hot everything and RAM catches fire.",
    chips: ["n=80k", "40 categoricals", "card up to 8k", "fraud"],
    prompt: "Which library should you reach for first?",
    best: "catboost",
    acceptable: ["lightgbm"],
    why: {
      catboost:
        "CatBoost was built for this: native categoricals plus ordered target statistics, so you skip leaky encodings and giant one-hots.",
      lightgbm:
        "LightGBM can take categorical_feature and is workable, but ordered CatBoost stats are the cleaner default for high-cardinality cats.",
      xgboost:
        "XGBoost’s categorical support is newer and still less central than CatBoost’s. One-hot or target encoding puts leakage and memory back on you.",
    },
    learned:
      "High-cardinality categoricals are CatBoost’s home turf. Native handling beats naive one-hot, and ordered target stats reduce encoding leakage.",
  },
  {
    id: "leaf-vs-level",
    title: "How the tree actually grows",
    topic: "Leaf-wise vs level-wise",
    setup:
      "Eight million row click table, ~45 numeric features, 2-hour CPU budget. You need a strong model tonight, not a research paper. Someone asks whether you want level-wise trees (balanced depth) or leaf-wise / best-first growth (split the current highest-gain leaf).",
    chips: ["n=8M", "numeric-heavy", "CPU", "tight train budget"],
    prompt: "Which library’s default growth story matches this job?",
    best: "lightgbm",
    acceptable: ["xgboost"],
    why: {
      lightgbm:
        "LightGBM grows leaf-wise with histogram bins. On large, mostly numeric tables that usually means fewer, more informative splits and a faster train.",
      xgboost:
        "XGBoost’s classic depth-wise (level-wise) growth is regularized and excellent, but typically slower than LightGBM at this scale on CPU.",
      catboost:
        "CatBoost’s symmetric (oblivious) trees are great for inference and cats, but they are not the speed kings on huge numeric CPU jobs.",
    },
    learned:
      "Leaf-wise (LightGBM) fits large data fast and can overfit small data. Level-wise (XGBoost) grows a balanced tree. CatBoost uses symmetric trees.",
  },
  {
    id: "sklearn-shap",
    title: "The stack you already have",
    topic: "Regularization and ecosystem",
    setup:
      "A bank already logs models in MLflow, explains them with SHAP, and wraps estimators in sklearn pipelines. The table is 200k rows, mostly numeric with a few low-card cats already ordinal-encoded. Compliance wants a well-traveled algorithm with L1/L2 knobs they have seen in reviews before.",
    chips: ["sklearn", "SHAP", "MLflow", "medium numeric"],
    prompt: "What do you ship so the surrounding system stays boring?",
    best: "xgboost",
    acceptable: ["lightgbm"],
    why: {
      xgboost:
        "XGBoost is still the ecosystem default: sklearn API, DART, monotone constraints, and SHAP’s original XGB path. Regularization is a first-class story.",
      lightgbm:
        "LightGBM has a sklearn wrapper and would train fine, but you would be the first to re-wire their review templates.",
      catboost:
        "CatBoost can work in sklearn, yet this org’s tribal knowledge, dashboards, and model cards all say XGBoost.",
    },
    learned:
      "Library choice is not only accuracy. XGBoost’s regularization knobs and production/Kaggle ecosystem are a real advantage.",
  },
  {
    id: "tiny-missing",
    title: "The 3,000-row mess",
    topic: "Small data and missing values",
    setup:
      "A clinic study has 3,000 rows, 18 mixed columns, and 30–60% missingness in labs that were never ordered. Labels are noisy. You must present a model Friday. No time for fancy imputers.",
    chips: ["n=3k", "30–60% missing", "noisy labels", "deadline"],
    prompt: "Which booster is the least likely to embarrass you on tiny, holey data?",
    best: "catboost",
    acceptable: ["xgboost"],
    why: {
      catboost:
        "Ordered boosting fights prediction shift on small n. Missing categoricals become their own category; numeric missings get a dedicated split path. Defaults are conservative.",
      xgboost:
        "XGBoost handles missing as a learned default direction and you can crank regularization. Still easier to overfit than CatBoost’s ordered scheme.",
      lightgbm:
        "Leaf-wise growth plus 3k rows is a classic overfit combo unless you aggressively limit leaves, which fights the library’s personality.",
    },
    learned:
      "All three handle missing natively. On small messy tables, CatBoost’s ordered boosting is the safer inductive bias; LightGBM wants more rows.",
  },
  {
    id: "sparse-hash",
    title: "Two million hashed clicks",
    topic: "Sparse data",
    setup:
      "You hashed n-grams and IDs into ~2 million sparse features. 500k rows sit in a CSR matrix. Density is under 0.2%. This is not “a few missing cells”; it is a high-dimensional sparse problem.",
    chips: ["500k × 2M", "CSR / sparse", "hashed IDs"],
    prompt: "Which library historically likes this matrix?",
    best: "xgboost",
    acceptable: ["lightgbm"],
    why: {
      xgboost:
        "XGBoost’s sparse-aware split finding was built for exactly this: zeros mean missing/unseen in a CSR world, not “the number 0 in a dense table.”",
      lightgbm:
        "LightGBM can consume sparse input and will often be faster, but XGBoost is the more battle-tested sparse default.",
      catboost:
        "CatBoost expects denser tabular layouts with real categoricals. Giant hashed sparse one-hots are the wrong shape.",
    },
    learned:
      "Sparse high-dim (text hashes, one-hot IDs) ≠ a table with NaNs. Prefer XGBoost or LightGBM; keep CatBoost for genuine categorical tables.",
  },
  {
    id: "budget-cpu",
    title: "Overnight vs this meeting",
    topic: "Size and speed budgets",
    setup:
      "50 million rows, 90 numeric features, memory on the box is tight, and the VP wants a baseline before stand-up. GPU is not available. You can downsample, but you’d rather use the histogram library that was designed for this.",
    chips: ["n=50M", "CPU", "memory-tight", "baseline now"],
    prompt: "Who wins the speed/memory budget?",
    best: "lightgbm",
    acceptable: ["xgboost"],
    why: {
      lightgbm:
        "Histogram binning, optional GOSS/EFB, leaf-wise growth, and a lighter memory footprint are why LightGBM dominates huge CPU tabular jobs.",
      xgboost:
        "XGBoost hist mode can work, but it is usually the slower, hungrier sibling at this scale.",
      catboost:
        "CatBoost training on 50M dense rows without GPU is the long path. Save it for when cats or inference dominate the spec.",
    },
    learned:
      "When n is huge and the clock is real, LightGBM’s histograms and leaf-wise strategy are the practical default on CPU.",
  },
  {
    id: "gpu-myth",
    title: "We have a GPU, so…",
    topic: "GPU myths vs reality",
    setup:
      "A teammate insists every booster should train on the lab’s A100 because “GPU is always faster.” The table is 12k rows by 11 features. You will do 40 random-search trials this afternoon.",
    chips: ["n=12k", "11 features", "A100 in the room", "many trials"],
    prompt: "Where do you actually train?",
    best: "xgboost",
    acceptable: ["lightgbm", "catboost"],
    why: {
      xgboost:
        "Any of the three on CPU is the grown-up move. XGBoost is a fine CPU default here; GPU kernels plus PCIe copies often lose on tiny tables, especially across 40 trials.",
      lightgbm:
        "CPU LightGBM is also fine. LightGBM’s GPU builds can be driver-picky; they are not free lunch on 12k rows.",
      catboost:
        "CatBoost’s GPU story is strong on larger cat-heavy jobs, but 12k rows will not amortize transfer. CPU is enough.",
    },
    learned:
      "GPU helps when histogram work is large enough to hide transfer and kernel overhead. Small tables often train faster on CPU. “Always GPU” is a myth.",
    note: "All three libraries are acceptable if you stay on CPU. The trap is forcing GPU because the machine has one.",
  },
  {
    id: "ordered-boosting",
    title: "The leak that looked like lift",
    topic: "Ordered boosting",
    setup:
      "Last quarter someone target-encoded `user_id` and `merchant` using the full training fold. Cross-validation looked magical; production fell off a cliff. You still have 22k rows, high-card cats, and a suspicious “encoding boost.”",
    chips: ["n=22k", "high-card cats", "prior CV leakage"],
    prompt: "Which method attacks this failure mode at the algorithm level?",
    best: "catboost",
    acceptable: [],
    why: {
      catboost:
        "Ordered boosting and ordered target statistics permute the data and compute encodings only from “past” rows, cutting prediction shift — the gap between train-time and test-time encodings.",
      lightgbm:
        "LightGBM categoricals are useful but they do not give you CatBoost’s ordered scheme. You still own leakage if you encode by hand.",
      xgboost:
        "XGBoost will happily fit a leaky target encoding. Regularization will not save a feature that already contains the label.",
    },
    learned:
      "Ordered boosting is CatBoost’s answer to prediction shift from target statistics. It is why CatBoost often needs less encoding ceremony.",
  },
  {
    id: "kaggle-default",
    title: "Need a strong numeric baseline",
    topic: "Regularized default",
    setup:
      "Bootcamp capstone: 180k rows of sensors, almost all numeric, mild missingness, no crazy cats. You want a library with a mountain of known hyperparameters, blog posts, and a reputation for regularized trees that don’t immediately memorize.",
    chips: ["n=180k", "numeric sensors", "need a baseline"],
    prompt: "What is the conservative first booster?",
    best: "xgboost",
    acceptable: ["lightgbm"],
    why: {
      xgboost:
        "Level-wise growth plus eta, lambda, gamma, subsample, colsample — the regularized workhorse. You will find a dozen reputable starting points in an hour.",
      lightgbm:
        "Often slightly faster and just as accurate here. It is a very acceptable second; just watch num_leaves so you do not overfit by accident.",
      catboost:
        "Will work, but you are not using its categorical or ordered-boosting edge. Fine, not first.",
    },
    learned:
      "On medium numeric tables, XGBoost is the documented regularized default. LightGBM is the speed variant of the same idea.",
  },
  {
    id: "inference-sla",
    title: "Two milliseconds or it pages",
    topic: "Inference budget",
    setup:
      "Training can run overnight. Serving cannot: a CPU API must score each event in ~2ms. Trees will be in the low hundreds. Categoricals exist (store, plan, device) but cardinality is moderate.",
    chips: ["CPU inference SLA", "overnight train", "a few cats"],
    prompt: "Whose tree shape helps serving the most?",
    best: "catboost",
    acceptable: ["lightgbm"],
    why: {
      catboost:
        "Symmetric / oblivious trees use the same split features across a level, which vectorizes and caches well. CatBoost is repeatedly chosen when inference, not training, is the bottleneck.",
      lightgbm:
        "Usually fewer leaves than a deep XGBoost ensemble and very fast, so it is a reasonable fallback if CatBoost train time is painful.",
      xgboost:
        "Serving XGBoost is common and fine, but it is not the library you pick *because* of inference layout.",
    },
    learned:
      "Training speed and inference speed are different budgets. CatBoost’s symmetric trees often win the serving SLA.",
  },
  {
    id: "monotone-reg",
    title: "Risk scores that must go up",
    topic: "Constraints and regularity",
    setup:
      "Credit risk. Three features must be monotone: utilization up → risk up. Data is 400k mostly numeric rows. Model review has templates for `monotone_constraints` and wants an algorithm reviewers have signed off on for years.",
    chips: ["monotone constraints", "credit risk", "numeric"],
    prompt: "Which library matches the constraint + review culture?",
    best: "xgboost",
    acceptable: ["lightgbm"],
    why: {
      xgboost:
        "Monotone constraints are mature in XGBoost, and so is the paper trail. You can keep regularization tight and show reviewers a familiar object.",
      lightgbm:
        "LightGBM also supports monotone constraints and would train faster. The review culture here still speaks XGBoost.",
      catboost:
        "CatBoost has monotone constraints too, but this is not a categorical-heavy problem and the org is not set up to defend CatBoost in model risk.",
    },
    learned:
      "When constraints, documentation, and reviewers matter, XGBoost’s maturity can outweigh a small accuracy gap.",
  },
  {
    id: "gpu-cats-medium",
    title: "GPU, but for a real workload",
    topic: "GPU when it actually helps",
    setup:
      "5 million rows, 25% categoricals including a few high-card IDs, a healthy GPU, and a week to tune. Training time matters; you are not on a 12k-row toy. You heard “CatBoost GPU is excellent” and “LightGBM GPU is picky.”",
    chips: ["n=5M", "25% cats", "GPU available", "tune for a week"],
    prompt: "What is the first serious GPU-era candidate?",
    best: "catboost",
    acceptable: ["lightgbm"],
    why: {
      catboost:
        "This is the GPU case that pays rent: large enough tables, real categoricals, and CatBoost’s GPU implementation is widely liked for tabular work.",
      lightgbm:
        "LightGBM GPU can be fast on numeric-heavy data but historically fussier to build/run. Acceptable if cats are encoded and the build works.",
      xgboost:
        "XGBoost GPU hist is solid, especially if you encode cats. You would be walking past CatBoost’s whole reason to exist on this brief.",
    },
    learned:
      "GPU is worth it on large histograms. Combine size with categoricals and CatBoost GPU becomes a first-class option, not a meme.",
  },
];

export const LAB_BRIEFS = [
  {
    id: "lab-retail",
    title: "Retail mix",
    spec: {
      rows: 120000,
      catShare: 0.55,
      cardinality: 4000,
      missing: 0.12,
      sparsity: 0.05,
      gpu: false,
      tightTrain: false,
      fastInfer: true,
      xgbTeam: false,
    },
    best: "catboost",
    acceptable: ["lightgbm"],
    hint: "Lots of cats, inference matters, not huge n.",
  },
  {
    id: "lab-ads",
    title: "Ads log",
    spec: {
      rows: 8000000,
      catShare: 0.08,
      cardinality: 20,
      missing: 0.03,
      sparsity: 0.15,
      gpu: false,
      tightTrain: true,
      fastInfer: false,
      xgbTeam: false,
    },
    best: "lightgbm",
    acceptable: ["xgboost"],
    hint: "Huge numeric-ish table, train budget is the product constraint.",
  },
  {
    id: "lab-sparse",
    title: "Hashed text",
    spec: {
      rows: 400000,
      catShare: 0.05,
      cardinality: 8,
      missing: 0.0,
      sparsity: 0.92,
      gpu: true,
      tightTrain: false,
      fastInfer: false,
      xgbTeam: true,
    },
    best: "xgboost",
    acceptable: ["lightgbm"],
    hint: "CSR-scale sparsity plus an XGBoost-fluent team.",
  },
  {
    id: "lab-clinic",
    title: "Clinic extract",
    spec: {
      rows: 8000,
      catShare: 0.35,
      cardinality: 80,
      missing: 0.4,
      sparsity: 0.04,
      gpu: true,
      tightTrain: false,
      fastInfer: false,
      xgbTeam: false,
    },
    best: "catboost",
    acceptable: ["xgboost"],
    hint: "Small n, holes, categoricals — ignore the idle GPU.",
  },
];
