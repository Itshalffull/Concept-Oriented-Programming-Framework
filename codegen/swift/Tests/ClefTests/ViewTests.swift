// ViewTests.swift — Tests for View concept

import XCTest
@testable import Clef

final class ViewTests: XCTestCase {

    // MARK: - create

    func testCreateView() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.create(
            input: ViewCreateInput(name: "All Tasks", dataSource: "tasks", layout: "table"),
            storage: storage
        )

        if case .ok(let viewId) = result {
            XCTAssertFalse(viewId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateViewStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.create(
            input: ViewCreateInput(name: "All Tasks", dataSource: "tasks", layout: "table"),
            storage: storage
        )

        if case .ok(let viewId) = result {
            let record = try await storage.get(relation: "view", key: viewId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "All Tasks")
            XCTAssertEqual(record?["dataSource"] as? String, "tasks")
            XCTAssertEqual(record?["layout"] as? String, "table")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - setFilter

    func testSetFilter() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "My View", dataSource: "items", layout: "list"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.setFilter(
            input: ViewSetFilterInput(viewId: viewId, rules: "status=active"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, viewId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetFilterNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.setFilter(
            input: ViewSetFilterInput(viewId: "nonexistent", rules: "status=active"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testSetFilterUpdatesStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "My View", dataSource: "items", layout: "list"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.setFilter(
            input: ViewSetFilterInput(viewId: viewId, rules: "status=active"),
            storage: storage
        )

        let record = try await storage.get(relation: "view", key: viewId)
        XCTAssertEqual(record?["filterRules"] as? String, "status=active")
    }

    // MARK: - setSort

    func testSetSort() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "My View", dataSource: "items", layout: "list"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.setSort(
            input: ViewSetSortInput(viewId: viewId, rules: "createdAt:desc"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, viewId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetSortNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.setSort(
            input: ViewSetSortInput(viewId: "missing", rules: "name:asc"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - setGroup

    func testSetGroup() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "My View", dataSource: "items", layout: "board"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.setGroup(
            input: ViewSetGroupInput(viewId: viewId, field: "status"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, viewId)
            let record = try await storage.get(relation: "view", key: viewId)
            XCTAssertEqual(record?["groupField"] as? String, "status")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetGroupNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.setGroup(
            input: ViewSetGroupInput(viewId: "missing", field: "status"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - setVisibleFields

    func testSetVisibleFields() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "My View", dataSource: "items", layout: "table"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.setVisibleFields(
            input: ViewSetVisibleFieldsInput(viewId: viewId, fieldIds: "name,status,date"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, viewId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetVisibleFieldsNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.setVisibleFields(
            input: ViewSetVisibleFieldsInput(viewId: "missing", fieldIds: "name"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - changeLayout

    func testChangeLayout() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "My View", dataSource: "items", layout: "table"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.changeLayout(
            input: ViewChangeLayoutInput(viewId: viewId, layout: "board"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, viewId)
            let record = try await storage.get(relation: "view", key: viewId)
            XCTAssertEqual(record?["layout"] as? String, "board")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testChangeLayoutNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.changeLayout(
            input: ViewChangeLayoutInput(viewId: "missing", layout: "gallery"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - duplicate

    func testDuplicate() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let createResult = try await handler.create(
            input: ViewCreateInput(name: "Original View", dataSource: "items", layout: "table"),
            storage: storage
        )
        guard case .ok(let viewId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.duplicate(
            input: ViewDuplicateInput(viewId: viewId),
            storage: storage
        )

        if case .ok(let newViewId) = result {
            XCTAssertFalse(newViewId.isEmpty)
            XCTAssertNotEqual(newViewId, viewId)
            let record = try await storage.get(relation: "view", key: newViewId)
            XCTAssertEqual(record?["name"] as? String, "Original View (copy)")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDuplicateNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ViewHandlerImpl()

        let result = try await handler.duplicate(
            input: ViewDuplicateInput(viewId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
