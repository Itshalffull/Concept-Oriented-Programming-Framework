// WorkflowTests.swift — Tests for Workflow concept

import XCTest
@testable import Clef

final class WorkflowTests: XCTestCase {

    // MARK: - defineState

    func testDefineState() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        let result = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "draft", config: "{\"label\":\"Draft\"}"),
            storage: storage
        )

        if case .ok(let workflowId, let stateName) = result {
            XCTAssertEqual(workflowId, "w1")
            XCTAssertEqual(stateName, "draft")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineStateStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        _ = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "published", config: "{}"),
            storage: storage
        )

        let record = try await storage.get(relation: "workflow", key: "w1:published")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["stateName"] as? String, "published")
        XCTAssertEqual(record?["type"] as? String, "state")
    }

    func testDefineMultipleStates() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        _ = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "draft", config: "{}"),
            storage: storage
        )
        _ = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "review", config: "{}"),
            storage: storage
        )
        _ = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "published", config: "{}"),
            storage: storage
        )

        let draft = try await storage.get(relation: "workflow", key: "w1:draft")
        let review = try await storage.get(relation: "workflow", key: "w1:review")
        let published = try await storage.get(relation: "workflow", key: "w1:published")
        XCTAssertNotNil(draft)
        XCTAssertNotNil(review)
        XCTAssertNotNil(published)
    }

    // MARK: - defineTransition

    func testDefineTransition() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        let result = try await handler.defineTransition(
            input: WorkflowDefineTransitionInput(
                workflowId: "w1",
                fromState: "draft",
                toState: "review",
                guard_: "has_content"
            ),
            storage: storage
        )

        if case .ok(let workflowId) = result {
            XCTAssertEqual(workflowId, "w1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineTransitionStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        _ = try await handler.defineTransition(
            input: WorkflowDefineTransitionInput(
                workflowId: "w1",
                fromState: "draft",
                toState: "published",
                guard_: "approved"
            ),
            storage: storage
        )

        let record = try await storage.get(relation: "workflow", key: "w1:draft->published")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["fromState"] as? String, "draft")
        XCTAssertEqual(record?["toState"] as? String, "published")
        XCTAssertEqual(record?["guard"] as? String, "approved")
    }

    func testDefineMultipleTransitions() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        _ = try await handler.defineTransition(
            input: WorkflowDefineTransitionInput(workflowId: "w1", fromState: "draft", toState: "review", guard_: ""),
            storage: storage
        )
        _ = try await handler.defineTransition(
            input: WorkflowDefineTransitionInput(workflowId: "w1", fromState: "review", toState: "published", guard_: ""),
            storage: storage
        )

        let t1 = try await storage.get(relation: "workflow", key: "w1:draft->review")
        let t2 = try await storage.get(relation: "workflow", key: "w1:review->published")
        XCTAssertNotNil(t1)
        XCTAssertNotNil(t2)
    }

    // MARK: - transition

    func testTransition() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        // Set up workflow states and transition
        _ = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "draft", config: "{}"),
            storage: storage
        )
        _ = try await handler.defineState(
            input: WorkflowDefineStateInput(workflowId: "w1", name: "published", config: "{}"),
            storage: storage
        )
        _ = try await handler.defineTransition(
            input: WorkflowDefineTransitionInput(workflowId: "w1", fromState: "draft", toState: "published", guard_: ""),
            storage: storage
        )

        // Set initial state
        try await storage.put(
            relation: "workflow_state",
            key: "e1:w1",
            value: ["entityId": "e1", "workflowId": "w1", "state": "draft"]
        )

        let result = try await handler.transition(
            input: WorkflowTransitionInput(entityId: "e1", workflowId: "w1", targetState: "published"),
            storage: storage
        )

        if case .ok(let entityId, let fromState, let toState) = result {
            XCTAssertEqual(entityId, "e1")
            XCTAssertEqual(fromState, "draft")
            XCTAssertEqual(toState, "published")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testTransitionNotAllowed() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        // Set initial state but no transition defined
        try await storage.put(
            relation: "workflow_state",
            key: "e1:w1",
            value: ["entityId": "e1", "workflowId": "w1", "state": "draft"]
        )

        let result = try await handler.transition(
            input: WorkflowTransitionInput(entityId: "e1", workflowId: "w1", targetState: "published"),
            storage: storage
        )

        if case .notAllowed(let message) = result {
            XCTAssertTrue(message.contains("draft"))
            XCTAssertTrue(message.contains("published"))
        } else {
            XCTFail("Expected .notAllowed but got \(result)")
        }
    }

    func testTransitionEntityNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        let result = try await handler.transition(
            input: WorkflowTransitionInput(entityId: "e1", workflowId: "w1", targetState: "published"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("e1"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getCurrentState

    func testGetCurrentState() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        try await storage.put(
            relation: "workflow_state",
            key: "e1:w1",
            value: ["entityId": "e1", "workflowId": "w1", "state": "review"]
        )

        let result = try await handler.getCurrentState(
            input: WorkflowGetCurrentStateInput(entityId: "e1", workflowId: "w1"),
            storage: storage
        )

        if case .ok(let entityId, let state) = result {
            XCTAssertEqual(entityId, "e1")
            XCTAssertEqual(state, "review")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetCurrentStateNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = WorkflowHandlerImpl()

        let result = try await handler.getCurrentState(
            input: WorkflowGetCurrentStateInput(entityId: "e1", workflowId: "w1"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("e1"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
