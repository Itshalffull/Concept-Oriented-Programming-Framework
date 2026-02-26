// generated: ContentParser/Handler.swift

import Foundation

protocol ContentParserHandler {
    func registerFormat(
        input: ContentParserRegisterFormatInput,
        storage: ConceptStorage
    ) async throws -> ContentParserRegisterFormatOutput

    func registerExtractor(
        input: ContentParserRegisterExtractorInput,
        storage: ConceptStorage
    ) async throws -> ContentParserRegisterExtractorOutput

    func parse(
        input: ContentParserParseInput,
        storage: ConceptStorage
    ) async throws -> ContentParserParseOutput

    func extractRefs(
        input: ContentParserExtractRefsInput,
        storage: ConceptStorage
    ) async throws -> ContentParserExtractRefsOutput

    func extractTags(
        input: ContentParserExtractTagsInput,
        storage: ConceptStorage
    ) async throws -> ContentParserExtractTagsOutput

    func extractProperties(
        input: ContentParserExtractPropertiesInput,
        storage: ConceptStorage
    ) async throws -> ContentParserExtractPropertiesOutput

    func serialize(
        input: ContentParserSerializeInput,
        storage: ConceptStorage
    ) async throws -> ContentParserSerializeOutput

}
