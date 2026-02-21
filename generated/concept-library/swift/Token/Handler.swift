// generated: Token/Handler.swift

import Foundation

protocol TokenHandler {
    func replace(
        input: TokenReplaceInput,
        storage: ConceptStorage
    ) async throws -> TokenReplaceOutput

    func getAvailableTokens(
        input: TokenGetAvailableTokensInput,
        storage: ConceptStorage
    ) async throws -> TokenGetAvailableTokensOutput

    func scan(
        input: TokenScanInput,
        storage: ConceptStorage
    ) async throws -> TokenScanOutput

    func registerProvider(
        input: TokenRegisterProviderInput,
        storage: ConceptStorage
    ) async throws -> TokenRegisterProviderOutput

}
