// generated: ExposedFilter/Handler.swift

import Foundation

protocol ExposedFilterHandler {
    func expose(
        input: ExposedFilterExposeInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterExposeOutput

    func collectInput(
        input: ExposedFilterCollectInputInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterCollectInputOutput

    func applyToQuery(
        input: ExposedFilterApplyToQueryInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterApplyToQueryOutput

    func resetToDefaults(
        input: ExposedFilterResetToDefaultsInput,
        storage: ConceptStorage
    ) async throws -> ExposedFilterResetToDefaultsOutput

}
