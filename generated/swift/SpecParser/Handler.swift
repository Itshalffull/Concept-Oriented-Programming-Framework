// generated: SpecParser/Handler.swift

import Foundation

protocol SpecParserHandler {
    func parse(
        input: SpecParserParseInput,
        storage: ConceptStorage
    ) async throws -> SpecParserParseOutput

}
