// generated: Flag/Handler.swift

import Foundation

protocol FlagHandler {
    func flag(
        input: FlagFlagInput,
        storage: ConceptStorage
    ) async throws -> FlagFlagOutput

    func unflag(
        input: FlagUnflagInput,
        storage: ConceptStorage
    ) async throws -> FlagUnflagOutput

    func isFlagged(
        input: FlagIsFlaggedInput,
        storage: ConceptStorage
    ) async throws -> FlagIsFlaggedOutput

    func getCount(
        input: FlagGetCountInput,
        storage: ConceptStorage
    ) async throws -> FlagGetCountOutput

}
