// generated: ProcessEvent/Handler.swift

import Foundation

protocol ProcessEventHandler {
    func append(
        input: ProcessEventAppendInput,
        storage: ConceptStorage
    ) async throws -> ProcessEventAppendOutput

    func query(
        input: ProcessEventQueryInput,
        storage: ConceptStorage
    ) async throws -> ProcessEventQueryOutput

    func queryByType(
        input: ProcessEventQueryByTypeInput,
        storage: ConceptStorage
    ) async throws -> ProcessEventQueryByTypeOutput

    func getCursor(
        input: ProcessEventGetCursorInput,
        storage: ConceptStorage
    ) async throws -> ProcessEventGetCursorOutput

}
