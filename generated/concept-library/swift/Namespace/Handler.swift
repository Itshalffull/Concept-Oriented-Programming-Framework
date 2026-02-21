// generated: Namespace/Handler.swift

import Foundation

protocol NamespaceHandler {
    func createNamespacedPage(
        input: NamespaceCreateNamespacedPageInput,
        storage: ConceptStorage
    ) async throws -> NamespaceCreateNamespacedPageOutput

    func getChildren(
        input: NamespaceGetChildrenInput,
        storage: ConceptStorage
    ) async throws -> NamespaceGetChildrenOutput

    func getHierarchy(
        input: NamespaceGetHierarchyInput,
        storage: ConceptStorage
    ) async throws -> NamespaceGetHierarchyOutput

    func move(
        input: NamespaceMoveInput,
        storage: ConceptStorage
    ) async throws -> NamespaceMoveOutput

}
