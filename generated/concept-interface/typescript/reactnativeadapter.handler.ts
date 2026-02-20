// generated: reactnativeadapter.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./reactnativeadapter.types";

export interface ReactNativeAdapterHandler {
  normalize(input: T.ReactNativeAdapterNormalizeInput, storage: ConceptStorage):
    Promise<T.ReactNativeAdapterNormalizeOutput>;
}
