// generated: View/Handler.swift

import Foundation

protocol ViewHandler {
    func create(
        input: ViewCreateInput,
        storage: ConceptStorage
    ) async throws -> ViewCreateOutput

    func setFilter(
        input: ViewSetFilterInput,
        storage: ConceptStorage
    ) async throws -> ViewSetFilterOutput

    func setSort(
        input: ViewSetSortInput,
        storage: ConceptStorage
    ) async throws -> ViewSetSortOutput

    func setGroup(
        input: ViewSetGroupInput,
        storage: ConceptStorage
    ) async throws -> ViewSetGroupOutput

    func setVisibleFields(
        input: ViewSetVisibleFieldsInput,
        storage: ConceptStorage
    ) async throws -> ViewSetVisibleFieldsOutput

    func changeLayout(
        input: ViewChangeLayoutInput,
        storage: ConceptStorage
    ) async throws -> ViewChangeLayoutOutput

    func duplicate(
        input: ViewDuplicateInput,
        storage: ConceptStorage
    ) async throws -> ViewDuplicateOutput

    func embed(
        input: ViewEmbedInput,
        storage: ConceptStorage
    ) async throws -> ViewEmbedOutput

}
