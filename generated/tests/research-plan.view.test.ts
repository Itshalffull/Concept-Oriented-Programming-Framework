// generated/tests/research-plan.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\research-plan.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: research-plan', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "research-plan-dataSource", {"name":"research-plan-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "research-plan-presentation", {"name":"research-plan-presentation","displayType":"table","hints":"{}"});
    await storage.put("projection", "research-plan-projection", {"name":"research-plan-projection","fields":"[]"});
    await storage.put("interaction", "research-plan-interaction", {"name":"research-plan-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "research-plan", {"name":"research-plan","title":"research-plan","description":"","dataSource":"research-plan-dataSource","filter":"","sort":"","group":"","projection":"research-plan-projection","presentation":"research-plan-presentation","interaction":"research-plan-interaction","features":"[\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("research-plan", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
