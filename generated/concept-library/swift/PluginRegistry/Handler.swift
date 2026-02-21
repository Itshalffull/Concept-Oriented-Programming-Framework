// generated: PluginRegistry/Handler.swift

import Foundation

protocol PluginRegistryHandler {
    func discover(
        input: PluginRegistryDiscoverInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryDiscoverOutput

    func createInstance(
        input: PluginRegistryCreateInstanceInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryCreateInstanceOutput

    func getDefinitions(
        input: PluginRegistryGetDefinitionsInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryGetDefinitionsOutput

    func alterDefinitions(
        input: PluginRegistryAlterDefinitionsInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryAlterDefinitionsOutput

    func derivePlugins(
        input: PluginRegistryDerivePluginsInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryDerivePluginsOutput

}
