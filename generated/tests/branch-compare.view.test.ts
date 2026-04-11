// generated/tests/branch-compare.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\branch-compare.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: branch-compare', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "branch-compare-dataSource", {"name":"branch-compare-dataSource","kind":"concept-action","config":"{\"concept\":\"VersionSpace\",\"action\":\"diff\",\"params\":{\"source\":\"{{branchA}}\",\"target\":\"{{branchB}}\"}}"});
    await storage.put("presentation", "branch-compare-presentation", {"name":"branch-compare-presentation","displayType":"table","hints":"{\"diffMode\":true}"});
    await storage.put("projection", "branch-compare-projection", {"name":"branch-compare-projection","fields":"[{\"key\":\"entity\",\"label\":\"Entity\"},{\"key\":\"operation\",\"label\":\"Change\",\"formatter\":\"badge\"},{\"key\":\"fields\",\"label\":\"Fields Changed\"},{\"key\":\"source\",\"label\":\"Source Branch\"},{\"key\":\"target\",\"label\":\"Target Branch\"}]"});
    await storage.put("interaction", "branch-compare-interaction", {"name":"branch-compare-interaction","createForm":"null","rowClick":"{\"action\":\"navigate\",\"destination\":\"entity-detail\"}"});
    await storage.put('view', "branch-compare", {"name":"branch-compare","title":"branch-compare","description":"","dataSource":"branch-compare-dataSource","filter":"","sort":"","group":"","projection":"branch-compare-projection","presentation":"branch-compare-presentation","interaction":"branch-compare-interaction","features":"[\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("branch-compare", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
