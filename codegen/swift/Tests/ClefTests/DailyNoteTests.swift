// DailyNoteTests.swift — Tests for DailyNote concept

import XCTest
@testable import Clef

final class DailyNoteTests: XCTestCase {

    // MARK: - getOrCreateToday

    func testGetOrCreateTodayCreatesNewNote() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        let result = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(),
            storage: storage
        )

        if case .ok(let pageId, let date, let created) = result {
            XCTAssertFalse(pageId.isEmpty)
            XCTAssertFalse(date.isEmpty)
            XCTAssertTrue(created)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetOrCreateTodayReturnsSameNoteOnSecondCall() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        let result1 = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(),
            storage: storage
        )
        let result2 = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(),
            storage: storage
        )

        guard case .ok(let pageId1, _, let created1) = result1,
              case .ok(let pageId2, _, let created2) = result2 else {
            return XCTFail("Expected both results to be .ok")
        }

        XCTAssertTrue(created1)
        XCTAssertFalse(created2)
        XCTAssertEqual(pageId1, pageId2)
    }

    func testGetOrCreateTodayStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        let result = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(),
            storage: storage
        )

        if case .ok(_, let date, _) = result {
            let record = try await storage.get(relation: "daily_note", key: date)
            XCTAssertNotNil(record)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - navigateToDate

    func testNavigateToDate() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        // Create today's note first
        let createResult = try await handler.getOrCreateToday(
            input: DailyNoteGetOrCreateTodayInput(),
            storage: storage
        )
        guard case .ok(let expectedPageId, let date, _) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.navigateToDate(
            input: DailyNoteNavigateToDateInput(date: date),
            storage: storage
        )

        if case .ok(let pageId) = result {
            XCTAssertEqual(pageId, expectedPageId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testNavigateToDateNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        let result = try await handler.navigateToDate(
            input: DailyNoteNavigateToDateInput(date: "2020-01-01"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("2020-01-01"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - listRecent

    func testListRecent() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        // Manually seed some daily notes
        try await storage.put(
            relation: "daily_note",
            key: "2025-01-01",
            value: ["pageId": "p1", "date": "2025-01-01", "createdAt": "2025-01-01T00:00:00Z"]
        )
        try await storage.put(
            relation: "daily_note",
            key: "2025-01-02",
            value: ["pageId": "p2", "date": "2025-01-02", "createdAt": "2025-01-02T00:00:00Z"]
        )
        try await storage.put(
            relation: "daily_note",
            key: "2025-01-03",
            value: ["pageId": "p3", "date": "2025-01-03", "createdAt": "2025-01-03T00:00:00Z"]
        )

        let result = try await handler.listRecent(
            input: DailyNoteListRecentInput(count: 2),
            storage: storage
        )

        if case .ok(let notes) = result {
            XCTAssertTrue(notes.contains("2025-01-03"))
            XCTAssertTrue(notes.contains("2025-01-02"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListRecentEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        let result = try await handler.listRecent(
            input: DailyNoteListRecentInput(count: 5),
            storage: storage
        )

        if case .ok(let notes) = result {
            XCTAssertEqual(notes, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListRecentLimitsCount() async throws {
        let storage = InMemoryStorage()
        let handler = DailyNoteHandlerImpl()

        for i in 1...5 {
            let dateStr = "2025-01-0\(i)"
            try await storage.put(
                relation: "daily_note",
                key: dateStr,
                value: ["pageId": "p\(i)", "date": dateStr, "createdAt": "\(dateStr)T00:00:00Z"]
            )
        }

        let result = try await handler.listRecent(
            input: DailyNoteListRecentInput(count: 3),
            storage: storage
        )

        if case .ok(let notes) = result {
            // Should have exactly 3 entries
            let data = notes.data(using: .utf8)!
            let array = try JSONSerialization.jsonObject(with: data) as! [[String: Any]]
            XCTAssertEqual(array.count, 3)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
