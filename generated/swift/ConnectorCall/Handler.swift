// generated: ConnectorCall/Handler.swift

import Foundation

protocol ConnectorCallHandler {
    func invoke(
        input: ConnectorCallInvokeInput,
        storage: ConceptStorage
    ) async throws -> ConnectorCallInvokeOutput

    func markSuccess(
        input: ConnectorCallMarkSuccessInput,
        storage: ConceptStorage
    ) async throws -> ConnectorCallMarkSuccessOutput

    func markFailure(
        input: ConnectorCallMarkFailureInput,
        storage: ConceptStorage
    ) async throws -> ConnectorCallMarkFailureOutput

    func getResult(
        input: ConnectorCallGetResultInput,
        storage: ConceptStorage
    ) async throws -> ConnectorCallGetResultOutput

}
