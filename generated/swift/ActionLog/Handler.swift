// generated: ActionLog/Handler.swift

import Foundation

protocol ActionLogHandler {
    func append(
        input: ActionLogAppendInput,
        storage: ConceptStorage
    ) async throws -> ActionLogAppendOutput

    func addEdge(
        input: ActionLogAddEdgeInput,
        storage: ConceptStorage
    ) async throws -> ActionLogAddEdgeOutput

    func query(
        input: ActionLogQueryInput,
        storage: ConceptStorage
    ) async throws -> ActionLogQueryOutput

}
