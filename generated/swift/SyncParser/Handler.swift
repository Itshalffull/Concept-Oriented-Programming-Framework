// generated: SyncParser/Handler.swift

import Foundation

protocol SyncParserHandler {
    func parse(
        input: SyncParserParseInput,
        storage: ConceptStorage
    ) async throws -> SyncParserParseOutput

}
