// generated/tests/form-editor.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\form-editor.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: form-editor', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "form-editor-dataSource", {"name":"form-editor-dataSource","kind":"concept-action","config":"{\"concept\":\"FormSpec\",\"action\":\"get\",\"params\":{\"form\":\"{{formId}}\"}}"});
    await storage.put("presentation", "form-editor-presentation", {"name":"form-editor-presentation","displayType":"detail","hints":"{\"editorMode\":\"form-builder\"}"});
    await storage.put("projection", "form-editor-projection", {"name":"form-editor-projection","fields":"[]"});
    await storage.put("interaction", "form-editor-interaction", {"name":"form-editor-interaction","createForm":"{}","rowClick":"{}","rowActions":"[{\"key\":\"save\",\"label\":\"Save\",\"concept\":\"FormSpec\",\"action\":\"update\"}]"});
    await storage.put('view', "form-editor", {"name":"form-editor","title":"form-editor","description":"","dataSource":"form-editor-dataSource","filter":"","sort":"","group":"","projection":"form-editor-projection","presentation":"form-editor-presentation","interaction":"form-editor-interaction","features":"[\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("form-editor", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
