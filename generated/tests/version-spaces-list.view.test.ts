// generated/tests/version-spaces-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\version-spaces-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: version-spaces-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "version-spaces-list-dataSource", {"name":"version-spaces-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"VersionSpace\"}}"});
    await storage.put("presentation", "version-spaces-list-presentation", {"name":"version-spaces-list-presentation","displayType":"card-grid","hints":"{}"});
    await storage.put("filter", "version-spaces-list-filter", {"name":"version-spaces-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "version-spaces-list-sort", {"name":"version-spaces-list-sort","keys":"[]"});
    await storage.put("projection", "version-spaces-list-projection", {"name":"version-spaces-list-projection","fields":"[]"});
    await storage.put("interaction", "version-spaces-list-interaction", {"name":"version-spaces-list-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "version-spaces-list", {"name":"version-spaces-list","title":"version-spaces-list","description":"","dataSource":"version-spaces-list-dataSource","filter":"version-spaces-list-filter","sort":"version-spaces-list-sort","group":"","projection":"version-spaces-list-projection","presentation":"version-spaces-list-presentation","interaction":"version-spaces-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("version-spaces-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
