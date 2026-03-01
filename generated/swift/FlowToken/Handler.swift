// generated: FlowToken/Handler.swift

import Foundation

protocol FlowTokenHandler {
    func emit(
        input: FlowTokenEmitInput,
        storage: ConceptStorage
    ) async throws -> FlowTokenEmitOutput

    func consume(
        input: FlowTokenConsumeInput,
        storage: ConceptStorage
    ) async throws -> FlowTokenConsumeOutput

    func kill(
        input: FlowTokenKillInput,
        storage: ConceptStorage
    ) async throws -> FlowTokenKillOutput

    func countActive(
        input: FlowTokenCountActiveInput,
        storage: ConceptStorage
    ) async throws -> FlowTokenCountActiveOutput

    func listActive(
        input: FlowTokenListActiveInput,
        storage: ConceptStorage
    ) async throws -> FlowTokenListActiveOutput

}
