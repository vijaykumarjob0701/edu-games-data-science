import { describe, expect, it } from "vitest";
import { makeToken, tokensMatch, parseCookie, serializeSessionCookie } from "../netlify/lib/session.mjs";
import { gradePick, scoreLibraries, starsFromRatio } from "../src/games/boosting/recommend.js";
import { LAB_BRIEFS } from "../src/games/boosting/scenarios.js";
import { evaluate, makeSplit, ARENAS, gradeArena } from "../src/games/overfitting/engine.js";
import { gradeMethod, RACES, buildPopulation, takeSample, meanOf } from "../src/games/sampling/engine.js";

describe("session cookies", () => {
  it("creates a stable HMAC token and rejects mismatches", () => {
    const token = makeToken("unit-test-secret");
    expect(token).toHaveLength(64);
    expect(tokensMatch(token, makeToken("unit-test-secret"))).toBe(true);
    expect(tokensMatch(token, makeToken("other"))).toBe(false);
    expect(tokensMatch("", token)).toBe(false);
  });

  it("round-trips the cookie name", () => {
    const cookie = serializeSessionCookie("abc123", { secure: false });
    expect(parseCookie(cookie)).toBe("abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Secure");
  });
});

describe("boosting recommendations", () => {
  it("grades exact and acceptable picks", () => {
    expect(gradePick("catboost", "catboost", ["lightgbm"]).points).toBe(3);
    expect(gradePick("lightgbm", "catboost", ["lightgbm"]).points).toBe(1);
    expect(gradePick("xgboost", "catboost", ["lightgbm"]).points).toBe(0);
  });

  it("matches lab brief winners", () => {
    for (const brief of LAB_BRIEFS) {
      const { winner } = scoreLibraries(brief.spec);
      expect(winner).toBe(brief.best);
    }
  });

  it("prefers CatBoost on cat-heavy small tables and LightGBM on huge numeric jobs", () => {
    expect(
      scoreLibraries({
        rows: 8000,
        catShare: 0.6,
        cardinality: 2000,
        missing: 0.3,
        sparsity: 0.02,
        gpu: false,
        tightTrain: false,
        fastInfer: true,
        xgbTeam: false,
      }).winner,
    ).toBe("catboost");
    expect(
      scoreLibraries({
        rows: 9_000_000,
        catShare: 0.05,
        cardinality: 8,
        missing: 0.02,
        sparsity: 0.1,
        gpu: false,
        tightTrain: true,
        fastInfer: false,
        xgbTeam: false,
      }).winner,
    ).toBe("lightgbm");
  });

  it("maps score ratio to stars", () => {
    expect(starsFromRatio(1)).toBe(5);
    expect(starsFromRatio(0)).toBe(0);
    expect(starsFromRatio(0.6)).toBe(3);
  });
});

describe("overfitting engine", () => {
  it("lets extra capacity fit training better than a stump on a wiggly series", () => {
    const arena = ARENAS.find((a) => a.id === "wiggle");
    const split = makeSplit(arena);
    const small = evaluate(arena, 1, 0.01, split);
    const bigger = evaluate(arena, 8, 0.01, split);
    expect(bigger.trainMse).toBeLessThan(small.trainMse);
  });

  it("awards full points under the target", () => {
    expect(gradeArena(0.05, 0.08).points).toBe(3);
    expect(gradeArena(0.4, 0.08).points).toBe(0);
  });
});

describe("sampling engine", () => {
  it("treats the designed trap as a miss", () => {
    const race = RACES[0];
    expect(gradeMethod(race, race.best[0]).points).toBe(3);
    expect(gradeMethod(race, race.trap).points).toBe(0);
  });

  it("builds a population and a sample with a finite mean", () => {
    const race = RACES[2];
    const pop = buildPopulation(race, 200, 3);
    const sample = takeSample(pop, "srs", 40, 4);
    expect(Number.isFinite(meanOf(sample))).toBe(true);
    expect(sample.length).toBeGreaterThan(0);
  });
});
