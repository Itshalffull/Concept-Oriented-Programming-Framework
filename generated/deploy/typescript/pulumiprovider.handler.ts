// generated: pulumiprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./pulumiprovider.types";

export interface PulumiProviderHandler {
  generate(input: T.PulumiProviderGenerateInput, storage: ConceptStorage):
    Promise<T.PulumiProviderGenerateOutput>;
  preview(input: T.PulumiProviderPreviewInput, storage: ConceptStorage):
    Promise<T.PulumiProviderPreviewOutput>;
  apply(input: T.PulumiProviderApplyInput, storage: ConceptStorage):
    Promise<T.PulumiProviderApplyOutput>;
  teardown(input: T.PulumiProviderTeardownInput, storage: ConceptStorage):
    Promise<T.PulumiProviderTeardownOutput>;
}
