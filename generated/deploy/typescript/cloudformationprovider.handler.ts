// generated: cloudformationprovider.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./cloudformationprovider.types";

export interface CloudFormationProviderHandler {
  generate(input: T.CloudFormationProviderGenerateInput, storage: ConceptStorage):
    Promise<T.CloudFormationProviderGenerateOutput>;
  preview(input: T.CloudFormationProviderPreviewInput, storage: ConceptStorage):
    Promise<T.CloudFormationProviderPreviewOutput>;
  apply(input: T.CloudFormationProviderApplyInput, storage: ConceptStorage):
    Promise<T.CloudFormationProviderApplyOutput>;
  teardown(input: T.CloudFormationProviderTeardownInput, storage: ConceptStorage):
    Promise<T.CloudFormationProviderTeardownOutput>;
}
