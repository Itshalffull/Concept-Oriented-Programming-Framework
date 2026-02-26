// ComponentTests.swift — Tests for Component concept

import XCTest
@testable import Clef

final class ComponentTests: XCTestCase {

    // MARK: - register

    func testRegisterComponent() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result = try await handler.register(
            input: ComponentRegisterInput(componentId: "c1", config: "color=red"),
            storage: storage
        )

        if case .ok(let componentId) = result {
            XCTAssertEqual(componentId, "c1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterComponentStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        _ = try await handler.register(
            input: ComponentRegisterInput(componentId: "c1", config: "size=large"),
            storage: storage
        )

        let record = try await storage.get(relation: "component", key: "c1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["componentId"] as? String, "c1")
        XCTAssertEqual(record?["config"] as? String, "size=large")
    }

    func testRegisterMultipleComponents() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result1 = try await handler.register(
            input: ComponentRegisterInput(componentId: "c1", config: "a"),
            storage: storage
        )
        let result2 = try await handler.register(
            input: ComponentRegisterInput(componentId: "c2", config: "b"),
            storage: storage
        )

        if case .ok(let id1) = result1 { XCTAssertEqual(id1, "c1") }
        else { XCTFail("Expected .ok for c1") }

        if case .ok(let id2) = result2 { XCTAssertEqual(id2, "c2") }
        else { XCTFail("Expected .ok for c2") }
    }

    // MARK: - place

    func testPlaceComponent() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result = try await handler.place(
            input: ComponentPlaceInput(componentId: "c1", region: "sidebar", weight: 10),
            storage: storage
        )

        if case .ok(let placementId) = result {
            XCTAssertFalse(placementId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testPlaceComponentStoresPlacement() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result = try await handler.place(
            input: ComponentPlaceInput(componentId: "c1", region: "header", weight: 5),
            storage: storage
        )

        if case .ok(let placementId) = result {
            let record = try await storage.get(relation: "placement", key: placementId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["componentId"] as? String, "c1")
            XCTAssertEqual(record?["region"] as? String, "header")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - setVisibility

    func testSetVisibilityOnExistingPlacement() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let placeResult = try await handler.place(
            input: ComponentPlaceInput(componentId: "c1", region: "sidebar", weight: 1),
            storage: storage
        )
        guard case .ok(let placementId) = placeResult else {
            XCTFail("Expected .ok for place"); return
        }

        let result = try await handler.setVisibility(
            input: ComponentSetVisibilityInput(placementId: placementId, conditions: "role=admin"),
            storage: storage
        )

        if case .ok(let pid) = result {
            XCTAssertEqual(pid, placementId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetVisibilityOnMissingPlacement() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result = try await handler.setVisibility(
            input: ComponentSetVisibilityInput(placementId: "nonexistent", conditions: "x"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - evaluateVisibility

    func testEvaluateVisibilityNoConditions() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let placeResult = try await handler.place(
            input: ComponentPlaceInput(componentId: "c1", region: "main", weight: 1),
            storage: storage
        )
        guard case .ok(let placementId) = placeResult else {
            XCTFail("Expected .ok for place"); return
        }

        let result = try await handler.evaluateVisibility(
            input: ComponentEvaluateVisibilityInput(placementId: placementId, context: "anything"),
            storage: storage
        )

        if case .ok(_, let visible) = result {
            XCTAssertTrue(visible)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEvaluateVisibilityWithMatchingCondition() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let placeResult = try await handler.place(
            input: ComponentPlaceInput(componentId: "c1", region: "main", weight: 1),
            storage: storage
        )
        guard case .ok(let placementId) = placeResult else {
            XCTFail("Expected .ok for place"); return
        }

        _ = try await handler.setVisibility(
            input: ComponentSetVisibilityInput(placementId: placementId, conditions: "admin"),
            storage: storage
        )

        let result = try await handler.evaluateVisibility(
            input: ComponentEvaluateVisibilityInput(placementId: placementId, context: "user is admin"),
            storage: storage
        )

        if case .ok(_, let visible) = result {
            XCTAssertTrue(visible)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEvaluateVisibilityNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result = try await handler.evaluateVisibility(
            input: ComponentEvaluateVisibilityInput(placementId: "missing", context: "x"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - render

    func testRenderComponent() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        _ = try await handler.register(
            input: ComponentRegisterInput(componentId: "c1", config: "theme=dark"),
            storage: storage
        )

        let result = try await handler.render(
            input: ComponentRenderInput(componentId: "c1", context: "page=home"),
            storage: storage
        )

        if case .ok(let componentId, let output) = result {
            XCTAssertEqual(componentId, "c1")
            XCTAssertTrue(output.contains("c1"))
            XCTAssertTrue(output.contains("theme=dark"))
            XCTAssertTrue(output.contains("page=home"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRenderComponentNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ComponentHandlerImpl()

        let result = try await handler.render(
            input: ComponentRenderInput(componentId: "missing", context: "x"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
