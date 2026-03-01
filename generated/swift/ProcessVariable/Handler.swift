// generated: ProcessVariable/Handler.swift

import Foundation

protocol ProcessVariableHandler {
    func set(
        input: ProcessVariableSetInput,
        storage: ConceptStorage
    ) async throws -> ProcessVariableSetOutput

    func get(
        input: ProcessVariableGetInput,
        storage: ConceptStorage
    ) async throws -> ProcessVariableGetOutput

    func merge(
        input: ProcessVariableMergeInput,
        storage: ConceptStorage
    ) async throws -> ProcessVariableMergeOutput

    func delete(
        input: ProcessVariableDeleteInput,
        storage: ConceptStorage
    ) async throws -> ProcessVariableDeleteOutput

    func list(
        input: ProcessVariableListInput,
        storage: ConceptStorage
    ) async throws -> ProcessVariableListOutput

    func snapshot(
        input: ProcessVariableSnapshotInput,
        storage: ConceptStorage
    ) async throws -> ProcessVariableSnapshotOutput

}
