// ContentParserTests.swift — Tests for ContentParser concept

import XCTest
@testable import COPF

final class ContentParserTests: XCTestCase {

    // MARK: - registerFormat

    func testRegisterFormatReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        let result = try await handler.registerFormat(
            input: ContentParserRegisterFormatInput(formatId: "markdown", parserConfig: "{}"),
            storage: storage
        )

        if case .ok(let formatId) = result {
            XCTAssertEqual(formatId, "markdown")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterFormatDuplicateReturnsAlreadyExists() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        _ = try await handler.registerFormat(
            input: ContentParserRegisterFormatInput(formatId: "markdown", parserConfig: "{}"),
            storage: storage
        )

        let result = try await handler.registerFormat(
            input: ContentParserRegisterFormatInput(formatId: "markdown", parserConfig: "{}"),
            storage: storage
        )

        if case .alreadyExists(let formatId) = result {
            XCTAssertEqual(formatId, "markdown")
        } else {
            XCTFail("Expected .alreadyExists but got \(result)")
        }
    }

    func testRegisterFormatStoresConfig() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        _ = try await handler.registerFormat(
            input: ContentParserRegisterFormatInput(formatId: "html", parserConfig: "{\"strict\":true}"),
            storage: storage
        )

        let record = try await storage.get(relation: "format", key: "html")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["parserConfig"] as? String, "{\"strict\":true}")
    }

    // MARK: - parse

    func testParseRegisteredFormatReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        _ = try await handler.registerFormat(
            input: ContentParserRegisterFormatInput(formatId: "markdown", parserConfig: "{}"),
            storage: storage
        )

        let result = try await handler.parse(
            input: ContentParserParseInput(content: "# Hello World", formatId: "markdown"),
            storage: storage
        )

        if case .ok(let ast, let extractedMetadata) = result {
            XCTAssertFalse(ast.isEmpty)
            XCTAssertFalse(extractedMetadata.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testParseUnknownFormatReturnsUnknownFormat() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        let result = try await handler.parse(
            input: ContentParserParseInput(content: "text", formatId: "unknown"),
            storage: storage
        )

        if case .unknownFormat(let formatId) = result {
            XCTAssertEqual(formatId, "unknown")
        } else {
            XCTFail("Expected .unknownFormat but got \(result)")
        }
    }

    // MARK: - extractRefs

    func testExtractRefsFindsWikiLinks() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        let result = try await handler.extractRefs(
            input: ContentParserExtractRefsInput(content: "See [[PageA]] and [[PageB]].", formatId: "markdown"),
            storage: storage
        )

        if case .ok(let refs) = result {
            XCTAssertTrue(refs.contains("PageA"))
            XCTAssertTrue(refs.contains("PageB"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExtractRefsNoLinksReturnsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        let result = try await handler.extractRefs(
            input: ContentParserExtractRefsInput(content: "No links here.", formatId: "markdown"),
            storage: storage
        )

        if case .ok(let refs) = result {
            XCTAssertEqual(refs, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - extractTags

    func testExtractTagsFindsHashTags() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        let result = try await handler.extractTags(
            input: ContentParserExtractTagsInput(content: "This is #important and #urgent.", formatId: "markdown"),
            storage: storage
        )

        if case .ok(let tags) = result {
            XCTAssertTrue(tags.contains("important"))
            XCTAssertTrue(tags.contains("urgent"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExtractTagsNoTagsReturnsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = ContentParserHandlerImpl()

        let result = try await handler.extractTags(
            input: ContentParserExtractTagsInput(content: "No tags here.", formatId: "markdown"),
            storage: storage
        )

        if case .ok(let tags) = result {
            XCTAssertEqual(tags, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
