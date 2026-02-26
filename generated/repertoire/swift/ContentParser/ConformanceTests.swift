// generated: ContentParser/ConformanceTests.swift

import XCTest
@testable import Clef

final class ContentParserConformanceTests: XCTestCase {

    func testContentParserInvariant1() async throws {
        // invariant 1: after registerFormat, parse, extractTags behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let a = "u-test-invariant-002"
        let t = "u-test-invariant-003"

        // --- AFTER clause ---
        // registerFormat(name: "markdown", grammar: "{}") -> ok(name: "markdown")
        let step1 = try await handler.registerFormat(
            input: ContentParserRegisterFormatInput(name: "markdown", grammar: "{}"),
            storage: storage
        )
        if case .ok(let name) = step1 {
            XCTAssertEqual(name, "markdown")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // parse(content: c, text: "Hello #tag [[ref]]", format: "markdown") -> ok(ast: a)
        let step2 = try await handler.parse(
            input: ContentParserParseInput(content: c, text: "Hello #tag [[ref]]", format: "markdown"),
            storage: storage
        )
        if case .ok(let ast) = step2 {
            XCTAssertEqual(ast, a)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // extractTags(content: c) -> ok(tags: t)
        let step3 = try await handler.extractTags(
            input: ContentParserExtractTagsInput(content: c),
            storage: storage
        )
        if case .ok(let tags) = step3 {
            XCTAssertEqual(tags, t)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
