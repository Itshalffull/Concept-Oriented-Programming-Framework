// generated: typography.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./typography.types";

export interface TypographyHandler {
  defineScale(input: T.TypographyDefineScaleInput, storage: ConceptStorage):
    Promise<T.TypographyDefineScaleOutput>;
  defineFontStack(input: T.TypographyDefineFontStackInput, storage: ConceptStorage):
    Promise<T.TypographyDefineFontStackOutput>;
  defineStyle(input: T.TypographyDefineStyleInput, storage: ConceptStorage):
    Promise<T.TypographyDefineStyleOutput>;
}
