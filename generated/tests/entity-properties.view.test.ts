// generated/tests/entity-properties.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\entity-properties.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: entity-properties', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "entity-properties-dataSource", {"name":"entity-properties-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"get\",\"params\":{\"node\":\"{{entityId}}\"}}"});
    await storage.put("presentation", "entity-properties-presentation", {"name":"entity-properties-presentation","displayType":"detail","hints":"{}"});
    await storage.put("projection", "entity-properties-projection", {"name":"entity-properties-projection","fields":"[{\"key\":\"node\",\"label\":\"ID\"},{\"key\":\"schemas\",\"label\":\"Schemas\"},{\"key\":\"createdBy\",\"label\":\"Source\"},{\"key\":\"metadata\",\"label\":\"Metadata\"}]"});
    await storage.put('view', "entity-properties", {"name":"entity-properties","title":"entity-properties","description":"","dataSource":"entity-properties-dataSource","filter":"","sort":"","group":"","projection":"entity-properties-projection","presentation":"entity-properties-presentation","interaction":"","features":"[\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("entity-properties", storage);
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
