// generated: QualitySignal/Handler.swift

import Foundation

protocol QualitySignalHandler {
    func record(
        input: QualitySignalRecordInput,
        storage: ConceptStorage
    ) async throws -> QualitySignalRecordOutput

    func latest(
        input: QualitySignalLatestInput,
        storage: ConceptStorage
    ) async throws -> QualitySignalLatestOutput

    func rollup(
        input: QualitySignalRollupInput,
        storage: ConceptStorage
    ) async throws -> QualitySignalRollupOutput

    func explain(
        input: QualitySignalExplainInput,
        storage: ConceptStorage
    ) async throws -> QualitySignalExplainOutput

}