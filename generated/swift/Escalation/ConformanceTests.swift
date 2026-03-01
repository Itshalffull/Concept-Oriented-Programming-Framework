// generated: Escalation/ConformanceTests.swift

import XCTest
@testable import Clef

final class EscalationConformanceTests: XCTestCase {

    func testEscalationEscalateAndAccept() async throws {
        // invariant: after escalate, accept transitions the escalation to accepted
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-1", stepId: "step-1", reason: "SLA breach", targetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let escalationId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(escalationId.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.accept(
            input: EscalationAcceptInput(escalationId: escalationId, acceptedBy: "support-lead"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testEscalationResolve() async throws {
        // invariant: after escalate and accept, resolve completes the escalation
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-2", stepId: "step-2", reason: "Customer complaint", targetLevel: "L3"),
            storage: storage
        )
        guard case .ok(let escalationId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.accept(
            input: EscalationAcceptInput(escalationId: escalationId, acceptedBy: "eng-lead"),
            storage: storage
        )

        let step3 = try await handler.resolve(
            input: EscalationResolveInput(escalationId: escalationId, resolution: "Fixed root cause"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testEscalationReEscalate() async throws {
        // invariant: reEscalate creates a new escalation at a higher level
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-3", stepId: "step-3", reason: "Unresolved", targetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let escalationId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.reEscalate(
            input: EscalationReEscalateInput(escalationId: escalationId, reason: "Still unresolved", newTargetLevel: "L3"),
            storage: storage
        )
        if case .ok(let newEscalationId) = step2 {
            XCTAssertFalse(newEscalationId.isEmpty)
            XCTAssertNotEqual(newEscalationId, escalationId)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
