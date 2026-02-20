// generated: nativescriptadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./nativescriptadapter.types";

export interface NativeScriptAdapterHandler {
  normalize(input: T.NativeScriptAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.NativeScriptAdapterNormalizeOutput>;
}
