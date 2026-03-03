// generated: Contract/Handler.swift

import Foundation

protocol ContractHandler {
    func define(
        input: ContractDefineInput,
        storage: ConceptStorage
    ) async throws -> ContractDefineOutput

    func verify(
        input: ContractVerifyInput,
        storage: ConceptStorage
    ) async throws -> ContractVerifyOutput

    func compose(
        input: ContractComposeInput,
        storage: ConceptStorage
    ) async throws -> ContractComposeOutput

    func discharge(
        input: ContractDischargeInput,
        storage: ConceptStorage
    ) async throws -> ContractDischargeOutput

    func list(
        input: ContractListInput,
        storage: ConceptStorage
    ) async throws -> ContractListOutput

}