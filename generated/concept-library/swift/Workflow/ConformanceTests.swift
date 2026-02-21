// generated: Workflow/ConformanceTests.swift

import XCTest
@testable import COPF

final class WorkflowConformanceTests: XCTestCase {

    func testWorkflowInvariant1() async throws {
        // invariant 1: after defineState, defineState, defineTransition, transition, getCurrentState behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let w = "u-test-invariant-001"

        // --- AFTER clause ---
        // defineState(workflow: w, name: "draft", flags: "initial") -> ok()
        let step1 = try await handler.defineState(
            input: WorkflowDefineStateInput(workflow: w, name: "draft", flags: "initial"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // defineState(workflow: w, name: "published", flags: "") -> ok()
        let step2 = try await handler.defineState(
            input: WorkflowDefineStateInput(workflow: w, name: "published", flags: ""),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // defineTransition(workflow: w, from: "draft", to: "published", label: "publish", guard: "approved") -> ok()
        let step3 = try await handler.defineTransition(
            input: WorkflowDefineTransitionInput(workflow: w, from: "draft", to: "published", label: "publish", guard: "approved"),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
        // transition(workflow: w, entity: "doc1", transition: "publish") -> ok(newState: "published")
        let step4 = try await handler.transition(
            input: WorkflowTransitionInput(workflow: w, entity: "doc1", transition: "publish"),
            storage: storage
        )
        if case .ok(let newState) = step4 {
            XCTAssertEqual(newState, "published")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
        // getCurrentState(workflow: w, entity: "doc1") -> ok(state: "published")
        let step5 = try await handler.getCurrentState(
            input: WorkflowGetCurrentStateInput(workflow: w, entity: "doc1"),
            storage: storage
        )
        if case .ok(let state) = step5 {
            XCTAssertEqual(state, "published")
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

}
