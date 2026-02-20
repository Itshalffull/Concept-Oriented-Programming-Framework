// generated: elevation.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./elevation.types";

export interface ElevationHandler {
  define(input: T.ElevationDefineInput, storage: ConceptStorage):
    Promise<T.ElevationDefineOutput>;
  get(input: T.ElevationGetInput, storage: ConceptStorage):
    Promise<T.ElevationGetOutput>;
  generateScale(input: T.ElevationGenerateScaleInput, storage: ConceptStorage):
    Promise<T.ElevationGenerateScaleOutput>;
}
