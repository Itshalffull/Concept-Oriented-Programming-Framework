// generated: Outline/Handler.swift

import Foundation

protocol OutlineHandler {
    func create(
        input: OutlineCreateInput,
        storage: ConceptStorage
    ) async throws -> OutlineCreateOutput

    func indent(
        input: OutlineIndentInput,
        storage: ConceptStorage
    ) async throws -> OutlineIndentOutput

    func outdent(
        input: OutlineOutdentInput,
        storage: ConceptStorage
    ) async throws -> OutlineOutdentOutput

    func moveUp(
        input: OutlineMoveUpInput,
        storage: ConceptStorage
    ) async throws -> OutlineMoveUpOutput

    func moveDown(
        input: OutlineMoveDownInput,
        storage: ConceptStorage
    ) async throws -> OutlineMoveDownOutput

    func collapse(
        input: OutlineCollapseInput,
        storage: ConceptStorage
    ) async throws -> OutlineCollapseOutput

    func expand(
        input: OutlineExpandInput,
        storage: ConceptStorage
    ) async throws -> OutlineExpandOutput

    func reparent(
        input: OutlineReparentInput,
        storage: ConceptStorage
    ) async throws -> OutlineReparentOutput

    func getChildren(
        input: OutlineGetChildrenInput,
        storage: ConceptStorage
    ) async throws -> OutlineGetChildrenOutput

}
