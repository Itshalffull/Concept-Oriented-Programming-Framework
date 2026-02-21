// generated: Query/Handler.swift

import Foundation

protocol QueryHandler {
    func parse(
        input: QueryParseInput,
        storage: ConceptStorage
    ) async throws -> QueryParseOutput

    func execute(
        input: QueryExecuteInput,
        storage: ConceptStorage
    ) async throws -> QueryExecuteOutput

    func subscribe(
        input: QuerySubscribeInput,
        storage: ConceptStorage
    ) async throws -> QuerySubscribeOutput

    func addFilter(
        input: QueryAddFilterInput,
        storage: ConceptStorage
    ) async throws -> QueryAddFilterOutput

    func addSort(
        input: QueryAddSortInput,
        storage: ConceptStorage
    ) async throws -> QueryAddSortOutput

    func setScope(
        input: QuerySetScopeInput,
        storage: ConceptStorage
    ) async throws -> QuerySetScopeOutput

}
