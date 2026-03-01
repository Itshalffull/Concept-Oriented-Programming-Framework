// generated: LLMCall/Handler.swift

import Foundation

protocol LLMCallHandler {
    func request(
        input: LLMCallRequestInput,
        storage: ConceptStorage
    ) async throws -> LLMCallRequestOutput

    func recordResponse(
        input: LLMCallRecordResponseInput,
        storage: ConceptStorage
    ) async throws -> LLMCallRecordResponseOutput

    func validate(
        input: LLMCallValidateInput,
        storage: ConceptStorage
    ) async throws -> LLMCallValidateOutput

    func repair(
        input: LLMCallRepairInput,
        storage: ConceptStorage
    ) async throws -> LLMCallRepairOutput

    func accept(
        input: LLMCallAcceptInput,
        storage: ConceptStorage
    ) async throws -> LLMCallAcceptOutput

    func reject(
        input: LLMCallRejectInput,
        storage: ConceptStorage
    ) async throws -> LLMCallRejectOutput

}
