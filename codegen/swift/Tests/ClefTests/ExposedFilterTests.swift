// ExposedFilterTests.swift — Tests for ExposedFilter concept

import XCTest
@testable import Clef

final class ExposedFilterTests: XCTestCase {

    // MARK: - expose

    func testExposeCreatesFilter() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        let result = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status=active"),
            storage: storage
        )

        if case .ok(let filterId) = result {
            XCTAssertEqual(filterId, "f1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExposeStoresFilterInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status=active"),
            storage: storage
        )

        let record = try await storage.get(relation: "exposed_filter", key: "f1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["id"] as? String, "f1")
        XCTAssertEqual(record?["config"] as? String, "status=active")
        XCTAssertEqual(record?["userValue"] as? String, "")
    }

    func testExposeMultipleFilters() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )
        let result = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f2", config: "category"),
            storage: storage
        )

        if case .ok(let filterId) = result {
            XCTAssertEqual(filterId, "f2")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - collectInput

    func testCollectInputUpdatesUserValue() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )

        let result = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f1", userValue: "published"),
            storage: storage
        )

        if case .ok(let filterId) = result {
            XCTAssertEqual(filterId, "f1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "exposed_filter", key: "f1")
        XCTAssertEqual(record?["userValue"] as? String, "published")
    }

    func testCollectInputNotFoundReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        let result = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "nonexistent", userValue: "val"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testCollectInputOverwritesPreviousValue() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )
        _ = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f1", userValue: "draft"),
            storage: storage
        )
        _ = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f1", userValue: "published"),
            storage: storage
        )

        let record = try await storage.get(relation: "exposed_filter", key: "f1")
        XCTAssertEqual(record?["userValue"] as? String, "published")
    }

    // MARK: - applyToQuery

    func testApplyToQueryReturnsAppliedFilters() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )
        _ = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f1", userValue: "active"),
            storage: storage
        )

        let result = try await handler.applyToQuery(
            input: ExposedFilterApplyToQueryInput(queryId: "q1"),
            storage: storage
        )

        if case .ok(let queryId, let appliedFilters) = result {
            XCTAssertEqual(queryId, "q1")
            XCTAssertTrue(appliedFilters.contains("f1"))
            XCTAssertTrue(appliedFilters.contains("active"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testApplyToQueryExcludesEmptyUserValues() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )

        let result = try await handler.applyToQuery(
            input: ExposedFilterApplyToQueryInput(queryId: "q1"),
            storage: storage
        )

        if case .ok(let queryId, let appliedFilters) = result {
            XCTAssertEqual(queryId, "q1")
            XCTAssertEqual(appliedFilters, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - resetToDefaults

    func testResetToDefaultsClearsUserValues() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )
        _ = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f1", userValue: "active"),
            storage: storage
        )

        let result = try await handler.resetToDefaults(
            input: ExposedFilterResetToDefaultsInput(),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "exposed_filter", key: "f1")
        XCTAssertEqual(record?["userValue"] as? String, "")
    }

    func testResetToDefaultsReturnsZeroWhenNoFilters() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        let result = try await handler.resetToDefaults(
            input: ExposedFilterResetToDefaultsInput(),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testResetToDefaultsResetsMultipleFilters() async throws {
        let storage = InMemoryStorage()
        let handler = ExposedFilterHandlerImpl()

        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f1", config: "status"),
            storage: storage
        )
        _ = try await handler.expose(
            input: ExposedFilterExposeInput(filterId: "f2", config: "category"),
            storage: storage
        )
        _ = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f1", userValue: "active"),
            storage: storage
        )
        _ = try await handler.collectInput(
            input: ExposedFilterCollectInputInput(filterId: "f2", userValue: "tech"),
            storage: storage
        )

        let result = try await handler.resetToDefaults(
            input: ExposedFilterResetToDefaultsInput(),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
