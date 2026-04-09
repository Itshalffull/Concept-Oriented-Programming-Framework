// generated/tests/source-library.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\source-library.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: source-library', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "source-library-dataSource", {"name":"source-library-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "source-library-presentation", {"name":"source-library-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "source-library-filter", {"name":"source-library-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "source-library-sort", {"name":"source-library-sort","keys":"[]"});
    await storage.put("pagination", "source-library-pagination", {"name":"source-library-pagination","mode":"offset","pageSize":"25"});
    await storage.put("projection", "source-library-projection", {"name":"source-library-projection","fields":"[]"});
    await storage.put('view', "source-library", {"name":"source-library","title":"source-library","description":"","dataSource":"source-library-dataSource","filter":"source-library-filter","sort":"source-library-sort","group":"","projection":"source-library-projection","presentation":"source-library-presentation","interaction":"","features":"[\"filter\",\"sort\",\"pagination\",\"projection\"]","pagination":"source-library-pagination"});
    analysis = await compileAndAnalyze("source-library", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: has pagination", () => {
    expect(analysis.enabledFeatures).toContain("pagination");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
