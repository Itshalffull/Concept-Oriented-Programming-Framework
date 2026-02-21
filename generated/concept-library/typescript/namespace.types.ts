// generated: namespace.types.ts

export interface NamespaceCreateNamespacedPageInput {
  node: string;
  path: string;
}

export type NamespaceCreateNamespacedPageOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface NamespaceGetChildrenInput {
  node: string;
}

export type NamespaceGetChildrenOutput =
  { variant: "ok"; children: string }
  | { variant: "notfound"; message: string };

export interface NamespaceGetHierarchyInput {
  node: string;
}

export type NamespaceGetHierarchyOutput =
  { variant: "ok"; hierarchy: string }
  | { variant: "notfound"; message: string };

export interface NamespaceMoveInput {
  node: string;
  newPath: string;
}

export type NamespaceMoveOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

