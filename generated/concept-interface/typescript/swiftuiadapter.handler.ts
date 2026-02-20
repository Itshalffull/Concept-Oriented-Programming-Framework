// generated: swiftuiadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./swiftuiadapter.types";

export interface SwiftUIAdapterHandler {
  normalize(input: T.SwiftUIAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.SwiftUIAdapterNormalizeOutput>;
}
