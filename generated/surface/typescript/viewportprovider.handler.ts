// generated: viewportprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./viewportprovider.types";

export interface ViewportProviderHandler {
  initialize(input: T.ViewportProviderInitializeInput, storage: ConceptStorage):
    Promise<T.ViewportProviderInitializeOutput>;
  observe(input: T.ViewportProviderObserveInput, storage: ConceptStorage):
    Promise<T.ViewportProviderObserveOutput>;
  getBreakpoint(input: T.ViewportProviderGetBreakpointInput, storage: ConceptStorage):
    Promise<T.ViewportProviderGetBreakpointOutput>;
  setBreakpoints(input: T.ViewportProviderSetBreakpointsInput, storage: ConceptStorage):
    Promise<T.ViewportProviderSetBreakpointsOutput>;
}
