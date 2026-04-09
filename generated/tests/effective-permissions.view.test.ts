// generated/tests/effective-permissions.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\effective-permissions.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: effective-permissions', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "effective-permissions-dataSource", {"name":"effective-permissions-dataSource","kind":"concept-action","config":"{\"concept\":\"Authorization\",\"action\":\"listEffective\",\"params\":{\"subject\":\"{{subjectId}}\"}}"});
    await storage.put("presentation", "effective-permissions-presentation", {"name":"effective-permissions-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "effective-permissions-filter", {"name":"effective-permissions-filter","node":"{\"type\":\"eq\",\"field\":\"resource\",\"value\":\"all\"}"});
    await storage.put("sort", "effective-permissions-sort", {"name":"effective-permissions-sort","keys":"[{\"field\":\"resource\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "effective-permissions-projection", {"name":"effective-permissions-projection","fields":"[{\"key\":\"subject\",\"label\":\"Subject\"},{\"key\":\"resource\",\"label\":\"Resource\"},{\"key\":\"permission\",\"label\":\"Permission\"},{\"key\":\"source\",\"label\":\"Source\"},{\"key\":\"inherited\",\"label\":\"Inherited\"}]"});
    await storage.put('view', "effective-permissions", {"name":"effective-permissions","title":"effective-permissions","description":"","dataSource":"effective-permissions-dataSource","filter":"effective-permissions-filter","sort":"effective-permissions-sort","group":"","projection":"effective-permissions-projection","presentation":"effective-permissions-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("effective-permissions", storage);
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
