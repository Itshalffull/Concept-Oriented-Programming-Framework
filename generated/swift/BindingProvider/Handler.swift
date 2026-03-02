// generated: BindingProvider/Handler.swift

import Foundation

protocol BindingProviderHandler {
    func initialize(
        input: BindingProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderInitializeOutput

    func bind(
        input: BindingProviderBindInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderBindOutput

    func sync(
        input: BindingProviderSyncInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderSyncOutput

    func invoke(
        input: BindingProviderInvokeInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderInvokeOutput

    func unbind(
        input: BindingProviderUnbindInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderUnbindOutput

}
