// generated: DailyNote/Adapter.swift

import Foundation

class DailyNoteAdapter: ConceptTransport {
    private let handler: any DailyNoteHandler
    private let storage: ConceptStorage

    init(handler: any DailyNoteHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "getOrCreateToday":
            let input = try decoder.decode(DailyNoteGetOrCreateTodayInput.self, from: invocation.inputData)
            let output = try await handler.getOrCreateToday(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "navigateToDate":
            let input = try decoder.decode(DailyNoteNavigateToDateInput.self, from: invocation.inputData)
            let output = try await handler.navigateToDate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "listRecent":
            let input = try decoder.decode(DailyNoteListRecentInput.self, from: invocation.inputData)
            let output = try await handler.listRecent(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        default:
            throw ConceptError.unknownAction(invocation.action)
        }
    }

    func query(request: ConceptQuery) async throws -> [Data] {
        try await storage.find(relation: request.relation, args: request.args)
    }

    func health() async throws -> (healthy: Bool, latencyMs: UInt64) {
        (true, 0)
    }
}
