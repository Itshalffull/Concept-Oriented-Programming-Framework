// generated: terraformprovider.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./terraformprovider.types";

export interface TerraformProviderHandler {
  generate(input: T.TerraformProviderGenerateInput, storage: ConceptStorage):
    Promise<T.TerraformProviderGenerateOutput>;
  preview(input: T.TerraformProviderPreviewInput, storage: ConceptStorage):
    Promise<T.TerraformProviderPreviewOutput>;
  apply(input: T.TerraformProviderApplyInput, storage: ConceptStorage):
    Promise<T.TerraformProviderApplyOutput>;
  teardown(input: T.TerraformProviderTeardownInput, storage: ConceptStorage):
    Promise<T.TerraformProviderTeardownOutput>;
}
