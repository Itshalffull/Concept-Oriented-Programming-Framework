// QueryTests.swift — Tests for Query concept

import XCTest
@testable import Clef

final class QueryTests: XCTestCase {

    // MARK: - create

    func testCreateReturnsOkWithQueryId() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let result = try await handler.create(
            input: QueryCreateInput(queryString: "type:page", scope: "workspace"),
            storage: storage
        )

        if case .ok(let queryId) = result {
            XCTAssertFalse(queryId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateStoresQueryDefinition() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let result = try await handler.create(
            input: QueryCreateInput(queryString: "tag:important", scope: "all"),
            storage: storage
        )

        if case .ok(let queryId) = result {
            let record = try await storage.get(relation: "query_def", key: queryId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["queryString"] as? String, "tag:important")
            XCTAssertEqual(record?["scope"] as? String, "all")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMultipleQueries() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let r1 = try await handler.create(
            input: QueryCreateInput(queryString: "q1", scope: "s1"),
            storage: storage
        )
        let r2 = try await handler.create(
            input: QueryCreateInput(queryString: "q2", scope: "s2"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertNotEqual(id1, id2)
        } else {
            XCTFail("Expected .ok for both")
        }
    }

    // MARK: - execute

    func testExecuteExistingQueryReturnsResults() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let createResult = try await handler.create(
            input: QueryCreateInput(queryString: "type:page", scope: "workspace"),
            storage: storage
        )

        guard case .ok(let queryId) = createResult else {
            return XCTFail("Expected create to succeed")
        }

        let result = try await handler.execute(
            input: QueryExecuteInput(queryId: queryId),
            storage: storage
        )

        if case .ok(let qId, let results) = result {
            XCTAssertEqual(qId, queryId)
            XCTAssertFalse(results.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExecuteMissingQueryReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let result = try await handler.execute(
            input: QueryExecuteInput(queryId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - addFilter

    func testAddFilterReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let createResult = try await handler.create(
            input: QueryCreateInput(queryString: "all", scope: "workspace"),
            storage: storage
        )

        guard case .ok(let queryId) = createResult else {
            return XCTFail("Expected create to succeed")
        }

        let result = try await handler.addFilter(
            input: QueryAddFilterInput(queryId: queryId, field: "status", operator: "eq", value: "active"),
            storage: storage
        )

        if case .ok(let qId) = result {
            XCTAssertEqual(qId, queryId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddFilterMissingQueryReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let result = try await handler.addFilter(
            input: QueryAddFilterInput(queryId: "missing", field: "f", operator: "eq", value: "v"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testAddMultipleFilters() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let createResult = try await handler.create(
            input: QueryCreateInput(queryString: "all", scope: "workspace"),
            storage: storage
        )

        guard case .ok(let queryId) = createResult else {
            return XCTFail("Expected create to succeed")
        }

        _ = try await handler.addFilter(
            input: QueryAddFilterInput(queryId: queryId, field: "status", operator: "eq", value: "active"),
            storage: storage
        )
        _ = try await handler.addFilter(
            input: QueryAddFilterInput(queryId: queryId, field: "type", operator: "eq", value: "page"),
            storage: storage
        )

        let record = try await storage.get(relation: "query_def", key: queryId)
        let filters = record?["filters"] as? String ?? "[]"
        XCTAssertTrue(filters.contains("status"))
        XCTAssertTrue(filters.contains("type"))
    }

    // MARK: - addSort

    func testAddSortReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let createResult = try await handler.create(
            input: QueryCreateInput(queryString: "all", scope: "workspace"),
            storage: storage
        )

        guard case .ok(let queryId) = createResult else {
            return XCTFail("Expected create to succeed")
        }

        let result = try await handler.addSort(
            input: QueryAddSortInput(queryId: queryId, field: "createdAt", direction: "desc"),
            storage: storage
        )

        if case .ok(let qId) = result {
            XCTAssertEqual(qId, queryId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddSortMissingQueryReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = QueryHandlerImpl()

        let result = try await handler.addSort(
            input: QueryAddSortInput(queryId: "missing", field: "name", direction: "asc"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
