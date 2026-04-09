// generated/tests/permissions-by-resource.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\permissions-by-resource.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: permissions-by-resource', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "permissions-by-resource-dataSource", {"name":"permissions-by-resource-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "permissions-by-resource-presentation", {"name":"permissions-by-resource-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "permissions-by-resource-filter", {"name":"permissions-by-resource-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "permissions-by-resource-sort", {"name":"permissions-by-resource-sort","keys":"[]"});
    await storage.put("projection", "permissions-by-resource-projection", {"name":"permissions-by-resource-projection","fields":"[]"});
    await storage.put('view', "permissions-by-resource", {"name":"permissions-by-resource","title":"permissions-by-resource","description":"","dataSource":"permissions-by-resource-dataSource","filter":"permissions-by-resource-filter","sort":"permissions-by-resource-sort","group":"","projection":"permissions-by-resource-projection","presentation":"permissions-by-resource-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("permissions-by-resource", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
