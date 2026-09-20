function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const METHODS = {
  srs: {
    name: "Simple random sample",
    blurb: "Every unit has equal chance. Unbiased if you actually have a frame.",
  },
  convenience: {
    name: "Convenience (mall / app-openers)",
    blurb: "Whoever is easy to grab. Usually younger, richer, or more engaged.",
  },
  voluntary: {
    name: "Voluntary response",
    blurb: "People who care enough to answer. Extremes over-index.",
  },
  stratified: {
    name: "Stratified by group",
    blurb: "Sample inside known segments, then reweight. Fixes known mix shift.",
  },
  survivorship: {
    name: "Survivors only",
    blurb: "Drop the units that left, churned, or died. Mean of the remaining is not the mean.",
  },
  recent: {
    name: "Last 7 days only",
    blurb: "Time-based convenience. Seasonality and novelty leak in.",
  },
};

export const RACES = [
  {
    id: "nps",
    title: "The shouty survey",
    setup:
      "You want mean satisfaction (0–10) for all users. True mean is 7.1. A public tweeted link will mostly pull people who loved or hated the launch.",
    trueMean: 7.1,
    groups: [
      { id: "quiet", weight: 0.7, mean: 7.2, vol: 0.8, engage: 0.15 },
      { id: "fans", weight: 0.15, mean: 9.4, vol: 0.4, engage: 0.9 },
      { id: "haters", weight: 0.15, mean: 3.1, vol: 0.7, engage: 0.85 },
    ],
    best: ["stratified", "srs"],
    trap: "voluntary",
    learned: "Voluntary response inflates variance and often the extremes. Stratify or use a proper frame.",
  },
  {
    id: "wages",
    title: "Who is in the food court?",
    setup:
      "Estimate average income in a city. Interviewing whoever is at the mall at 2pm oversamples shoppers and undersamples shift workers.",
    trueMean: 62,
    groups: [
      { id: "shift", weight: 0.35, mean: 41, vol: 8, mall: 0.12 },
      { id: "office", weight: 0.45, mean: 71, vol: 12, mall: 0.5 },
      { id: "high", weight: 0.2, mean: 98, vol: 18, mall: 0.7 },
    ],
    best: ["stratified", "srs"],
    trap: "convenience",
    learned: "Convenience samples describe the easy-to-reach subpopulation, not the city.",
  },
  {
    id: "churn",
    title: "Active users only",
    setup:
      "Product wants average weekly time-in-app. Dashboards drop anyone who uninstalled. Survivors are the happy ones.",
    trueMean: 48,
    groups: [
      { id: "churned", weight: 0.4, mean: 12, vol: 6, alive: 0 },
      { id: "casual", weight: 0.35, mean: 40, vol: 10, alive: 1 },
      { id: "power", weight: 0.25, mean: 110, vol: 16, alive: 1 },
    ],
    best: ["srs", "stratified"],
    trap: "survivorship",
    learned: "Survivorship bias is selection after the outcome. The remaining rows are not a random sample of users.",
  },
  {
    id: "flu",
    title: "Monday clinic",
    setup:
      "Estimate city-wide fever prevalence. Sampling only people who showed up at clinic this week mixes true flu with “people who seek care.”",
    trueMean: 0.08,
    groups: [
      { id: "healthy", weight: 0.86, mean: 0.02, vol: 0.02, clinic: 0.04 },
      { id: "mild", weight: 0.1, mean: 0.35, vol: 0.08, clinic: 0.4 },
      { id: "severe", weight: 0.04, mean: 0.8, vol: 0.1, clinic: 0.9 },
    ],
    best: ["stratified", "srs"],
    trap: "convenience",
    learned: "Healthcare samples are conditioned on seeking care. Prevalence in clinic ≠ prevalence in the city.",
  },
  {
    id: "launch",
    title: "We shipped Friday",
    setup:
      "Estimate conversion. Looking only at the 7 days after a launch captures novelty, ads, and a weekend mix that will not last.",
    trueMean: 0.041,
    groups: [
      { id: "steady", weight: 0.8, mean: 0.032, vol: 0.01, recent: 0.2 },
      { id: "launch-spike", weight: 0.2, mean: 0.09, vol: 0.02, recent: 0.95 },
    ],
    best: ["srs", "stratified"],
    trap: "recent",
    learned: "Time windows are a sampling frame. Recency bias is selection on a calendar, not on people.",
  },
  {
    id: "imbalance",
    title: "Fraud is 1.2%",
    setup:
      "You need a sample to estimate fraud rate and to train a first model. Uniform random is unbiased for the rate. Training may still need stratification so the minority class appears at all.",
    trueMean: 0.012,
    groups: [
      { id: "legit", weight: 0.988, mean: 0, vol: 0, rare: 0 },
      { id: "fraud", weight: 0.012, mean: 1, vol: 0, rare: 1 },
    ],
    best: ["stratified", "srs"],
    trap: "convenience",
    learned: "Stratified sampling can be unbiased for the mean if you reweight, and it guarantees you see the rare class.",
  },
  {
    id: "twitter",
    title: "Open comments",
    setup:
      "A newsroom estimates public support from quote-tweet replies. People with strong affect type more.",
    trueMean: 0.52,
    groups: [
      { id: "silent", weight: 0.6, mean: 0.5, vol: 0.05, engage: 0.05 },
      { id: "pro", weight: 0.2, mean: 0.92, vol: 0.04, engage: 0.7 },
      { id: "anti", weight: 0.2, mean: 0.08, vol: 0.04, engage: 0.75 },
    ],
    best: ["srs", "stratified"],
    trap: "voluntary",
    learned: "Reply threads are not polls. Engagement is correlated with extremity.",
  },
  {
    id: "cohort",
    title: "Only paying customers",
    setup:
      "Finance asks for average NPS of “the product.” You are handed a file of current subscribers. Cancelled accounts are gone.",
    trueMean: 6.4,
    groups: [
      { id: "cancelled", weight: 0.3, mean: 3.4, vol: 1.1, alive: 0 },
      { id: "monthly", weight: 0.5, mean: 7.0, vol: 1.0, alive: 1 },
      { id: "annual", weight: 0.2, mean: 8.2, vol: 0.7, alive: 1 },
    ],
    best: ["srs", "stratified"],
    trap: "survivorship",
    learned: "Conditioning on still-paying is survivorship. Say “NPS of current subscribers,” not “NPS of the product.”",
  },
];

function drawGroup(rng, group) {
  const z = rng() * 2 - 1 + (rng() * 2 - 1);
  return group.mean + z * (group.vol || 0) * 0.5;
}

export function buildPopulation(race, n = 400, seed = 1) {
  const rng = mulberry32(seed + race.title.length);
  const people = [];
  for (let i = 0; i < n; i += 1) {
    let r = rng();
    let group = race.groups[0];
    for (const g of race.groups) {
      r -= g.weight;
      if (r <= 0) {
        group = g;
        break;
      }
    }
    people.push({
      group: group.id,
      value: drawGroup(rng, group),
      mall: group.mall ?? 0.3,
      engage: group.engage ?? 0.3,
      alive: group.alive ?? 1,
      clinic: group.clinic ?? 0.2,
      recent: group.recent ?? 0.3,
      rare: group.rare ?? 0,
    });
  }
  return people;
}

export function takeSample(people, method, size, seed = 2) {
  const rng = mulberry32(seed + method.length * 17);
  const pool = people.filter((p) => {
    if (method === "survivorship") return p.alive > 0.5;
    if (method === "recent") return rng() < p.recent;
    if (method === "convenience") return rng() < p.mall || rng() < p.clinic;
    if (method === "voluntary") return rng() < p.engage;
    return true;
  });
  const chosen = [];
  if (method === "stratified") {
    const groups = [...new Set(people.map((p) => p.group))];
    const per = Math.max(2, Math.floor(size / groups.length));
    for (const g of groups) {
      const members = people.filter((p) => p.group === g);
      for (let i = 0; i < per && i < members.length; i += 1) {
        chosen.push(members[Math.floor(rng() * members.length)]);
      }
    }
  } else {
    const src = pool.length ? pool : people;
    for (let i = 0; i < size; i += 1) chosen.push(src[Math.floor(rng() * src.length)]);
  }
  return chosen;
}

export function meanOf(rows) {
  if (!rows.length) return 0;
  return rows.reduce((s, p) => s + p.value, 0) / rows.length;
}

export function gradeMethod(race, method) {
  if (race.best.includes(method)) return { points: 3, label: "Unbiased enough" };
  if (method === race.trap) return { points: 0, label: "You sampled the bias" };
  return { points: 1, label: "Not the trap, not the design" };
}
