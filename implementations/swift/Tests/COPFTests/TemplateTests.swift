// TemplateTests.swift — Tests for Template concept

import XCTest
@testable import COPF

final class TemplateTests: XCTestCase {

    // MARK: - define

    func testDefine() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        let result = try await handler.define(
            input: TemplateDefineInput(
                templateId: "t1",
                blockTree: "[{\"type\":\"heading\"}]",
                variables: "[\"title\",\"author\"]"
            ),
            storage: storage
        )

        if case .ok(let templateId) = result {
            XCTAssertEqual(templateId, "t1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        _ = try await handler.define(
            input: TemplateDefineInput(
                templateId: "t1",
                blockTree: "[{\"type\":\"heading\"}]",
                variables: "[\"title\"]"
            ),
            storage: storage
        )

        let record = try await storage.get(relation: "template", key: "t1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["blockTree"] as? String, "[{\"type\":\"heading\"}]")
        XCTAssertEqual(record?["variables"] as? String, "[\"title\"]")
        XCTAssertEqual(record?["trigger"] as? String, "")
    }

    func testDefineMultipleTemplates() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        let r1 = try await handler.define(
            input: TemplateDefineInput(templateId: "t1", blockTree: "[]", variables: "[]"),
            storage: storage
        )
        let r2 = try await handler.define(
            input: TemplateDefineInput(templateId: "t2", blockTree: "[]", variables: "[]"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertEqual(id1, "t1")
            XCTAssertEqual(id2, "t2")
        } else {
            XCTFail("Expected both results to be .ok")
        }
    }

    // MARK: - instantiate

    func testInstantiate() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        _ = try await handler.define(
            input: TemplateDefineInput(templateId: "t1", blockTree: "[]", variables: "[]"),
            storage: storage
        )

        let result = try await handler.instantiate(
            input: TemplateInstantiateInput(
                templateId: "t1",
                targetLocation: "/workspace/page1",
                bindings: "{\"title\": \"My Page\"}"
            ),
            storage: storage
        )

        if case .ok(let instanceId) = result {
            XCTAssertFalse(instanceId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testInstantiateNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        let result = try await handler.instantiate(
            input: TemplateInstantiateInput(
                templateId: "nonexistent",
                targetLocation: "/workspace",
                bindings: "{}"
            ),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testInstantiateStoresInstance() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        _ = try await handler.define(
            input: TemplateDefineInput(templateId: "t1", blockTree: "[]", variables: "[]"),
            storage: storage
        )

        let result = try await handler.instantiate(
            input: TemplateInstantiateInput(
                templateId: "t1",
                targetLocation: "/workspace/page1",
                bindings: "{\"title\": \"Hello\"}"
            ),
            storage: storage
        )

        if case .ok(let instanceId) = result {
            let record = try await storage.get(relation: "template", key: "instance:\(instanceId)")
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["templateId"] as? String, "t1")
            XCTAssertEqual(record?["targetLocation"] as? String, "/workspace/page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - registerTrigger

    func testRegisterTrigger() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        _ = try await handler.define(
            input: TemplateDefineInput(templateId: "t1", blockTree: "[]", variables: "[]"),
            storage: storage
        )

        let result = try await handler.registerTrigger(
            input: TemplateRegisterTriggerInput(templateId: "t1", condition: "on_page_create"),
            storage: storage
        )

        if case .ok(let templateId) = result {
            XCTAssertEqual(templateId, "t1")
            let record = try await storage.get(relation: "template", key: "t1")
            XCTAssertEqual(record?["trigger"] as? String, "on_page_create")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterTriggerNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        let result = try await handler.registerTrigger(
            input: TemplateRegisterTriggerInput(templateId: "nonexistent", condition: "on_edit"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testRegisterTriggerOverwritesPrevious() async throws {
        let storage = InMemoryStorage()
        let handler = TemplateHandlerImpl()

        _ = try await handler.define(
            input: TemplateDefineInput(templateId: "t1", blockTree: "[]", variables: "[]"),
            storage: storage
        )
        _ = try await handler.registerTrigger(
            input: TemplateRegisterTriggerInput(templateId: "t1", condition: "on_create"),
            storage: storage
        )
        _ = try await handler.registerTrigger(
            input: TemplateRegisterTriggerInput(templateId: "t1", condition: "on_update"),
            storage: storage
        )

        let record = try await storage.get(relation: "template", key: "t1")
        XCTAssertEqual(record?["trigger"] as? String, "on_update")
    }
}
