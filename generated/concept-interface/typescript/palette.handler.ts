// generated: palette.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./palette.types";

export interface PaletteHandler {
  generate(input: T.PaletteGenerateInput, storage: ConceptStorage):
    Promise<T.PaletteGenerateOutput>;
  assignRole(input: T.PaletteAssignRoleInput, storage: ConceptStorage):
    Promise<T.PaletteAssignRoleOutput>;
  checkContrast(input: T.PaletteCheckContrastInput, storage: ConceptStorage):
    Promise<T.PaletteCheckContrastOutput>;
}
