// generated: SearchIndex/ConformanceTests.swift

import XCTest
@testable import Clef

final class SearchIndexConformanceTests: XCTestCase {

    func testSearchIndexInvariant1() async throws {
        // invariant 1: after createIndex, indexItem, search behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let i = "u-test-invariant-001"
        let r = "u-test-invariant-002"

        // --- AFTER clause ---
        // createIndex(index: i, config: "{}") -> ok(index: i)
        let step1 = try await handler.createIndex(
            input: SearchIndexCreateIndexInput(index: i, config: "{}"),
            storage: storage
        )
        if case .ok(let index) = step1 {
            XCTAssertEqual(index, i)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // indexItem(index: i, item: "doc-1", data: "hello world") -> ok(index: i)
        let step2 = try await handler.indexItem(
            input: SearchIndexIndexItemInput(index: i, item: "doc-1", data: "hello world"),
            storage: storage
        )
        if case .ok(let index) = step2 {
            XCTAssertEqual(index, i)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // search(index: i, query: "hello") -> ok(results: r)
        let step3 = try await handler.search(
            input: SearchIndexSearchInput(index: i, query: "hello"),
            storage: storage
        )
        if case .ok(let results) = step3 {
            XCTAssertEqual(results, r)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
