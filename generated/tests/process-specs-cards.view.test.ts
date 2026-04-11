// generated/tests/process-specs-cards.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-specs-cards.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-specs-cards', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-specs-cards-dataSource", {"name":"process-specs-cards-dataSource","kind":"concept-action","config":"{\"concept\":\"ProcessSpec\",\"action\":\"list\"}"});
    await storage.put("presentation", "process-specs-cards-presentation", {"name":"process-specs-cards-presentation","displayType":"card-grid","hints":"{}"});
    await storage.put("filter", "process-specs-cards-filter", {"name":"process-specs-cards-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "process-specs-cards-sort", {"name":"process-specs-cards-sort","keys":"[]"});
    await storage.put("projection", "process-specs-cards-projection", {"name":"process-specs-cards-projection","fields":"[]"});
    await storage.put("interaction", "process-specs-cards-interaction", {"name":"process-specs-cards-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ProcessSpec\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "process-specs-cards", {"name":"process-specs-cards","title":"process-specs-cards","description":"","dataSource":"process-specs-cards-dataSource","filter":"process-specs-cards-filter","sort":"process-specs-cards-sort","group":"","projection":"process-specs-cards-projection","presentation":"process-specs-cards-presentation","interaction":"process-specs-cards-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("process-specs-cards", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ProcessSpec actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ProcessSpec/")).toBe(true);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
