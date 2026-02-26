// generated: PageAsRecord/ConformanceTests.swift

import XCTest
@testable import Clef

final class PageAsRecordConformanceTests: XCTestCase {

    func testPageAsRecordInvariant1() async throws {
        // invariant 1: after create, setProperty, getProperty behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let p = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(page: p, schema: "{"fields":["title"]}") -> ok(page: p)
        let step1 = try await handler.create(
            input: PageAsRecordCreateInput(page: p, schema: "{"fields":["title"]}"),
            storage: storage
        )
        if case .ok(let page) = step1 {
            XCTAssertEqual(page, p)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // setProperty(page: p, key: "title", value: "My Page") -> ok(page: p)
        let step2 = try await handler.setProperty(
            input: PageAsRecordSetPropertyInput(page: p, key: "title", value: "My Page"),
            storage: storage
        )
        if case .ok(let page) = step2 {
            XCTAssertEqual(page, p)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // getProperty(page: p, key: "title") -> ok(value: "My Page")
        let step3 = try await handler.getProperty(
            input: PageAsRecordGetPropertyInput(page: p, key: "title"),
            storage: storage
        )
        if case .ok(let value) = step3 {
            XCTAssertEqual(value, "My Page")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
