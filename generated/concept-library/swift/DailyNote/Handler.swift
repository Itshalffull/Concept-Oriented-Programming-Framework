// generated: DailyNote/Handler.swift

import Foundation

protocol DailyNoteHandler {
    func getOrCreateToday(
        input: DailyNoteGetOrCreateTodayInput,
        storage: ConceptStorage
    ) async throws -> DailyNoteGetOrCreateTodayOutput

    func navigateToDate(
        input: DailyNoteNavigateToDateInput,
        storage: ConceptStorage
    ) async throws -> DailyNoteNavigateToDateOutput

    func listRecent(
        input: DailyNoteListRecentInput,
        storage: ConceptStorage
    ) async throws -> DailyNoteListRecentOutput

}
