// generated: theme.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./theme.types";

export interface ThemeHandler {
  create(input: T.ThemeCreateInput, storage: ConceptStorage):
    Promise<T.ThemeCreateOutput>;
  extend(input: T.ThemeExtendInput, storage: ConceptStorage):
    Promise<T.ThemeExtendOutput>;
  activate(input: T.ThemeActivateInput, storage: ConceptStorage):
    Promise<T.ThemeActivateOutput>;
  deactivate(input: T.ThemeDeactivateInput, storage: ConceptStorage):
    Promise<T.ThemeDeactivateOutput>;
  resolve(input: T.ThemeResolveInput, storage: ConceptStorage):
    Promise<T.ThemeResolveOutput>;
}
