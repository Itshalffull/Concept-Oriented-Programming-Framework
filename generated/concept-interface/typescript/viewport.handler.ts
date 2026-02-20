// generated: viewport.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./viewport.types";

export interface ViewportHandler {
  observe(input: T.ViewportObserveInput, storage: ConceptStorage):
    Promise<T.ViewportObserveOutput>;
  setBreakpoints(input: T.ViewportSetBreakpointsInput, storage: ConceptStorage):
    Promise<T.ViewportSetBreakpointsOutput>;
  getBreakpoint(input: T.ViewportGetBreakpointInput, storage: ConceptStorage):
    Promise<T.ViewportGetBreakpointOutput>;
}
