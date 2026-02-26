// generated: DailyNote/ConformanceTests.swift

import XCTest
@testable import Clef

final class DailyNoteConformanceTests: XCTestCase {

    func testDailyNoteInvariant1() async throws {
        // invariant 1: after getOrCreateToday, getOrCreateToday behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let n = "u-test-invariant-001"

        // --- AFTER clause ---
        // getOrCreateToday(note: n) -> ok(note: n, created: true)
        let step1 = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(note: n),
            storage: storage
        )
        if case .ok(let note, let created) = step1 {
            XCTAssertEqual(note, n)
            XCTAssertEqual(created, true)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // getOrCreateToday(note: n) -> ok(note: n, created: false)
        let step2 = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(note: n),
            storage: storage
        )
        if case .ok(let note, let created) = step2 {
            XCTAssertEqual(note, n)
            XCTAssertEqual(created, false)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
