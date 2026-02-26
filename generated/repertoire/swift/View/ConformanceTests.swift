// generated: View/ConformanceTests.swift

import XCTest
@testable import Clef

final class ViewConformanceTests: XCTestCase {

    func testViewInvariant1() async throws {
        // invariant 1: after create, setFilter behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let v = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(view: v, dataSource: "tasks", layout: "table") -> ok(view: v)
        let step1 = try await handler.create(
            input: ViewCreateInput(view: v, dataSource: "tasks", layout: "table"),
            storage: storage
        )
        if case .ok(let view) = step1 {
            XCTAssertEqual(view, v)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // setFilter(view: v, filter: "status=active") -> ok(view: v)
        let step2 = try await handler.setFilter(
            input: ViewSetFilterInput(view: v, filter: "status=active"),
            storage: storage
        )
        if case .ok(let view) = step2 {
            XCTAssertEqual(view, v)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testViewInvariant2() async throws {
        // invariant 2: after setFilter, changeLayout behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let v = "u-test-invariant-001"

        // --- AFTER clause ---
        // setFilter(view: v, filter: "status=active") -> ok(view: v)
        let step1 = try await handler.setFilter(
            input: ViewSetFilterInput(view: v, filter: "status=active"),
            storage: storage
        )
        if case .ok(let view) = step1 {
            XCTAssertEqual(view, v)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // changeLayout(view: v, layout: "board") -> ok(view: v)
        let step2 = try await handler.changeLayout(
            input: ViewChangeLayoutInput(view: v, layout: "board"),
            storage: storage
        )
        if case .ok(let view) = step2 {
            XCTAssertEqual(view, v)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
