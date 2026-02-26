// generated: dockercomposeiacprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./dockercomposeiacprovider.types";

export interface DockerComposeIacProviderHandler {
  generate(input: T.DockerComposeIacProviderGenerateInput, storage: ConceptStorage):
    Promise<T.DockerComposeIacProviderGenerateOutput>;
  preview(input: T.DockerComposeIacProviderPreviewInput, storage: ConceptStorage):
    Promise<T.DockerComposeIacProviderPreviewOutput>;
  apply(input: T.DockerComposeIacProviderApplyInput, storage: ConceptStorage):
    Promise<T.DockerComposeIacProviderApplyOutput>;
  teardown(input: T.DockerComposeIacProviderTeardownInput, storage: ConceptStorage):
    Promise<T.DockerComposeIacProviderTeardownOutput>;
}
