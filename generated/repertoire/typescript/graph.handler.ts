// generated: graph.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./graph.types";

export interface GraphHandler {
  addNode(input: T.GraphAddNodeInput, storage: ConceptStorage):
    Promise<T.GraphAddNodeOutput>;
  removeNode(input: T.GraphRemoveNodeInput, storage: ConceptStorage):
    Promise<T.GraphRemoveNodeOutput>;
  addEdge(input: T.GraphAddEdgeInput, storage: ConceptStorage):
    Promise<T.GraphAddEdgeOutput>;
  removeEdge(input: T.GraphRemoveEdgeInput, storage: ConceptStorage):
    Promise<T.GraphRemoveEdgeOutput>;
  computeLayout(input: T.GraphComputeLayoutInput, storage: ConceptStorage):
    Promise<T.GraphComputeLayoutOutput>;
  getNeighbors(input: T.GraphGetNeighborsInput, storage: ConceptStorage):
    Promise<T.GraphGetNeighborsOutput>;
  filterNodes(input: T.GraphFilterNodesInput, storage: ConceptStorage):
    Promise<T.GraphFilterNodesOutput>;
}
