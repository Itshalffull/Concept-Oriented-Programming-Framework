// generated: awssmprovider.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./awssmprovider.types";

export interface AwsSmProviderHandler {
  fetch(input: T.AwsSmProviderFetchInput, storage: ConceptStorage):
    Promise<T.AwsSmProviderFetchOutput>;
  rotate(input: T.AwsSmProviderRotateInput, storage: ConceptStorage):
    Promise<T.AwsSmProviderRotateOutput>;
}
