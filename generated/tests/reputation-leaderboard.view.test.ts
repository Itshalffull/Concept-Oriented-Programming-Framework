// generated/tests/reputation-leaderboard.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\reputation-leaderboard.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: reputation-leaderboard', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "reputation-leaderboard-dataSource", {"name":"reputation-leaderboard-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "reputation-leaderboard-presentation", {"name":"reputation-leaderboard-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "reputation-leaderboard-sort", {"name":"reputation-leaderboard-sort","keys":"[{\"field\":\"score\",\"direction\":\"desc\"}]"});
    await storage.put("projection", "reputation-leaderboard-projection", {"name":"reputation-leaderboard-projection","fields":"[]"});
    await storage.put('view', "reputation-leaderboard", {"name":"reputation-leaderboard","title":"reputation-leaderboard","description":"","dataSource":"reputation-leaderboard-dataSource","filter":"","sort":"reputation-leaderboard-sort","group":"","projection":"reputation-leaderboard-projection","presentation":"reputation-leaderboard-presentation","interaction":"","features":"[\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("reputation-leaderboard", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: projects only known fields", () => {
    for (const f of analysis.projectedFields) {
      expect(["id", "participant", "score", "rank", "level"]).toContain(f);
    }
  });
  });
});
