// generated: processmetric.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./processmetric.types";

export interface ProcessMetricHandler {
  record(input: T.ProcessMetricRecordInput, storage: ConceptStorage):
    Promise<T.ProcessMetricRecordOutput>;
  query(input: T.ProcessMetricQueryInput, storage: ConceptStorage):
    Promise<T.ProcessMetricQueryOutput>;
  aggregate(input: T.ProcessMetricAggregateInput, storage: ConceptStorage):
    Promise<T.ProcessMetricAggregateOutput>;
}
