// generated: telemetry.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./telemetry.types";

export interface TelemetryHandler {
  configure(input: T.TelemetryConfigureInput, storage: ConceptStorage):
    Promise<T.TelemetryConfigureOutput>;
  deployMarker(input: T.TelemetryDeployMarkerInput, storage: ConceptStorage):
    Promise<T.TelemetryDeployMarkerOutput>;
  analyze(input: T.TelemetryAnalyzeInput, storage: ConceptStorage):
    Promise<T.TelemetryAnalyzeOutput>;
}
