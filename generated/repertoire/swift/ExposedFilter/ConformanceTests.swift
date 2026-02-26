// generated: ExposedFilter/ConformanceTests.swift

import XCTest
@testable import Clef

final class ExposedFilterConformanceTests: XCTestCase {

    func testExposedFilterInvariant1() async throws {
        // invariant 1: after expose, collectInput, applyToQuery behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"
        let m = "u-test-invariant-002"

        // --- AFTER clause ---
        // expose(filter: f, fieldName: "status", operator: "eq", defaultValue: "active") -> ok(filter: f)
        let step1 = try await handler.expose(
            input: ExposedFilterExposeInput(filter: f, fieldName: "status", operator: "eq", defaultValue: "active"),
            storage: storage
        )
        if case .ok(let filter) = step1 {
            XCTAssertEqual(filter, f)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // collectInput(filter: f, value: "archived") -> ok(filter: f)
        let step2 = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filter: f, value: "archived"),
            storage: storage
        )
        if case .ok(let filter) = step2 {
            XCTAssertEqual(filter, f)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // applyToQuery(filter: f) -> ok(queryMod: m)
        let step3 = try await handler.applyToQuery(
            input: ExposedFilterApplyToQueryInput(filter: f),
            storage: storage
        )
        if case .ok(let queryMod) = step3 {
            XCTAssertEqual(queryMod, m)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
