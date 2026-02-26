// generated: graph.types.ts

export interface GraphAddNodeInput {
  graph: string;
  node: string;
}

export type GraphAddNodeOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface GraphRemoveNodeInput {
  graph: string;
  node: string;
}

export type GraphRemoveNodeOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface GraphAddEdgeInput {
  graph: string;
  source: string;
  target: string;
}

export type GraphAddEdgeOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface GraphRemoveEdgeInput {
  graph: string;
  source: string;
  target: string;
}

export type GraphRemoveEdgeOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface GraphComputeLayoutInput {
  graph: string;
}

export type GraphComputeLayoutOutput =
  { variant: "ok"; layout: string }
  | { variant: "notfound" };

export interface GraphGetNeighborsInput {
  graph: string;
  node: string;
  depth: number;
}

export type GraphGetNeighborsOutput =
  { variant: "ok"; neighbors: string }
  | { variant: "notfound" };

export interface GraphFilterNodesInput {
  graph: string;
  filter: string;
}

export type GraphFilterNodesOutput =
  { variant: "ok"; filtered: string }
  | { variant: "notfound" };

