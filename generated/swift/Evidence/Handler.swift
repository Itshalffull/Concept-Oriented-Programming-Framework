// generated: Evidence/Handler.swift

import Foundation

protocol EvidenceHandler {
    func record(
        input: EvidenceRecordInput,
        storage: ConceptStorage
    ) async throws -> EvidenceRecordOutput

    func validate(
        input: EvidenceValidateInput,
        storage: ConceptStorage
    ) async throws -> EvidenceValidateOutput

    func retrieve(
        input: EvidenceRetrieveInput,
        storage: ConceptStorage
    ) async throws -> EvidenceRetrieveOutput

    func compare(
        input: EvidenceCompareInput,
        storage: ConceptStorage
    ) async throws -> EvidenceCompareOutput

    func minimize(
        input: EvidenceMinimizeInput,
        storage: ConceptStorage
    ) async throws -> EvidenceMinimizeOutput

    func list(
        input: EvidenceListInput,
        storage: ConceptStorage
    ) async throws -> EvidenceListOutput

}