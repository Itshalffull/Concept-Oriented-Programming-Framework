// generated: Taxonomy/Handler.swift

import Foundation

protocol TaxonomyHandler {
    func createVocabulary(
        input: TaxonomyCreateVocabularyInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyCreateVocabularyOutput

    func addTerm(
        input: TaxonomyAddTermInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyAddTermOutput

    func setParent(
        input: TaxonomySetParentInput,
        storage: ConceptStorage
    ) async throws -> TaxonomySetParentOutput

    func tagEntity(
        input: TaxonomyTagEntityInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyTagEntityOutput

    func untagEntity(
        input: TaxonomyUntagEntityInput,
        storage: ConceptStorage
    ) async throws -> TaxonomyUntagEntityOutput

}
