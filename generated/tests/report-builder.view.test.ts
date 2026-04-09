// generated/tests/report-builder.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\report-builder.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: report-builder', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "report-builder-dataSource", {"name":"report-builder-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "report-builder-presentation", {"name":"report-builder-presentation","displayType":"table","hints":"{}"});
    await storage.put("projection", "report-builder-projection", {"name":"report-builder-projection","fields":"[]"});
    await storage.put("interaction", "report-builder-interaction", {"name":"report-builder-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "report-builder", {"name":"report-builder","title":"report-builder","description":"","dataSource":"report-builder-dataSource","filter":"","sort":"","group":"","projection":"report-builder-projection","presentation":"report-builder-presentation","interaction":"report-builder-interaction","features":"[\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("report-builder", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
