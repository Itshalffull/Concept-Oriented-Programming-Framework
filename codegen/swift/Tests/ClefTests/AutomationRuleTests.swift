// AutomationRuleTests.swift — Tests for AutomationRule concept

import XCTest
@testable import Clef

final class AutomationRuleTests: XCTestCase {

    // MARK: - define

    func testDefine() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let result = try await handler.define(
            input: AutomationRuleDefineInput(
                trigger: "page_created",
                conditions: "type=task",
                actions: "set_status:todo",
                enabled: true
            ),
            storage: storage
        )

        if case .ok(let ruleId) = result {
            XCTAssertFalse(ruleId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let result = try await handler.define(
            input: AutomationRuleDefineInput(
                trigger: "page_updated",
                conditions: "has_deadline",
                actions: "send_notification",
                enabled: false
            ),
            storage: storage
        )

        if case .ok(let ruleId) = result {
            let record = try await storage.get(relation: "automation_rule", key: ruleId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["trigger"] as? String, "page_updated")
            XCTAssertEqual(record?["conditions"] as? String, "has_deadline")
            XCTAssertEqual(record?["actions"] as? String, "send_notification")
            XCTAssertEqual(record?["enabled"] as? Bool, false)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineMultipleRules() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let r1 = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "t1", conditions: "c1", actions: "a1", enabled: true),
            storage: storage
        )
        let r2 = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "t2", conditions: "c2", actions: "a2", enabled: true),
            storage: storage
        )

        guard case .ok(let id1) = r1, case .ok(let id2) = r2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - enable

    func testEnable() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let defineResult = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "t", conditions: "c", actions: "a", enabled: false),
            storage: storage
        )
        guard case .ok(let ruleId) = defineResult else {
            return XCTFail("Expected .ok on define")
        }

        let result = try await handler.enable(
            input: AutomationRuleEnableInput(ruleId: ruleId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, ruleId)
            let record = try await storage.get(relation: "automation_rule", key: ruleId)
            XCTAssertEqual(record?["enabled"] as? Bool, true)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEnableNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let result = try await handler.enable(
            input: AutomationRuleEnableInput(ruleId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - disable

    func testDisable() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let defineResult = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "t", conditions: "c", actions: "a", enabled: true),
            storage: storage
        )
        guard case .ok(let ruleId) = defineResult else {
            return XCTFail("Expected .ok on define")
        }

        let result = try await handler.disable(
            input: AutomationRuleDisableInput(ruleId: ruleId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, ruleId)
            let record = try await storage.get(relation: "automation_rule", key: ruleId)
            XCTAssertEqual(record?["enabled"] as? Bool, false)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDisableNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let result = try await handler.disable(
            input: AutomationRuleDisableInput(ruleId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testDisableAlreadyDisabled() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let defineResult = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "t", conditions: "c", actions: "a", enabled: false),
            storage: storage
        )
        guard case .ok(let ruleId) = defineResult else {
            return XCTFail("Expected .ok on define")
        }

        let result = try await handler.disable(
            input: AutomationRuleDisableInput(ruleId: ruleId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, ruleId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - evaluate

    func testEvaluateMatchesWhenEnabled() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let defineResult = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "page_created", conditions: "c", actions: "a", enabled: true),
            storage: storage
        )
        guard case .ok(let ruleId) = defineResult else {
            return XCTFail("Expected .ok on define")
        }

        let result = try await handler.evaluate(
            input: AutomationRuleEvaluateInput(ruleId: ruleId, event: "page_created in workspace"),
            storage: storage
        )

        if case .ok(let returnedId, let matched) = result {
            XCTAssertEqual(returnedId, ruleId)
            XCTAssertTrue(matched)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEvaluateDoesNotMatchWhenDisabled() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let defineResult = try await handler.define(
            input: AutomationRuleDefineInput(trigger: "page_created", conditions: "c", actions: "a", enabled: false),
            storage: storage
        )
        guard case .ok(let ruleId) = defineResult else {
            return XCTFail("Expected .ok on define")
        }

        let result = try await handler.evaluate(
            input: AutomationRuleEvaluateInput(ruleId: ruleId, event: "page_created in workspace"),
            storage: storage
        )

        if case .ok(_, let matched) = result {
            XCTAssertFalse(matched)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEvaluateNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = AutomationRuleHandlerImpl()

        let result = try await handler.evaluate(
            input: AutomationRuleEvaluateInput(ruleId: "nonexistent", event: "some_event"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
