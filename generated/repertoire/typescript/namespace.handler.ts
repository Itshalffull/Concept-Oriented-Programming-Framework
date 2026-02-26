// generated: namespace.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./namespace.types";

export interface NamespaceHandler {
  createNamespacedPage(input: T.NamespaceCreateNamespacedPageInput, storage: ConceptStorage):
    Promise<T.NamespaceCreateNamespacedPageOutput>;
  getChildren(input: T.NamespaceGetChildrenInput, storage: ConceptStorage):
    Promise<T.NamespaceGetChildrenOutput>;
  getHierarchy(input: T.NamespaceGetHierarchyInput, storage: ConceptStorage):
    Promise<T.NamespaceGetHierarchyOutput>;
  move(input: T.NamespaceMoveInput, storage: ConceptStorage):
    Promise<T.NamespaceMoveOutput>;
}
