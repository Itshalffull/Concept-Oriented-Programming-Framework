// generated: DesignTokenProvider/Handler.swift

import Foundation

protocol DesignTokenProviderHandler {
    func initialize(
        input: DesignTokenProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderInitializeOutput

    func resolve(
        input: DesignTokenProviderResolveInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderResolveOutput

    func switchTheme(
        input: DesignTokenProviderSwitchThemeInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderSwitchThemeOutput

    func getTokens(
        input: DesignTokenProviderGetTokensInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderGetTokensOutput

    func export(
        input: DesignTokenProviderExportInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderExportOutput

}
