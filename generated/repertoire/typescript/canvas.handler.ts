// generated: canvas.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./canvas.types";

export interface CanvasHandler {
  addNode(input: T.CanvasAddNodeInput, storage: ConceptStorage):
    Promise<T.CanvasAddNodeOutput>;
  moveNode(input: T.CanvasMoveNodeInput, storage: ConceptStorage):
    Promise<T.CanvasMoveNodeOutput>;
  connectNodes(input: T.CanvasConnectNodesInput, storage: ConceptStorage):
    Promise<T.CanvasConnectNodesOutput>;
  groupNodes(input: T.CanvasGroupNodesInput, storage: ConceptStorage):
    Promise<T.CanvasGroupNodesOutput>;
  embedFile(input: T.CanvasEmbedFileInput, storage: ConceptStorage):
    Promise<T.CanvasEmbedFileOutput>;
}
