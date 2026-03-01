// generated: Escalation/BusinessTests.swift

import XCTest
@testable import Clef

final class EscalationBusinessTests: XCTestCase {

    // MARK: - Full lifecycle: escalate -> accept -> resolve

    func testFullEscalationLifecycle() async throws {
        // An escalation should support the full lifecycle from creation to resolution
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-full", stepId: "step-full", reason: "Response time exceeded", targetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let escalationId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.accept(
            input: EscalationAcceptInput(escalationId: escalationId, acceptedBy: "team-lead"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.resolve(
            input: EscalationResolveInput(escalationId: escalationId, resolution: "Assigned dedicated resource"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple re-escalations

    func testMultipleReEscalationsCreateNewIds() async throws {
        // Each re-escalation should create a distinct new escalation
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-re-esc", stepId: "step-re", reason: "Initial timeout", targetLevel: "L1"),
            storage: storage
        )
        guard case .ok(let esc1) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.reEscalate(
            input: EscalationReEscalateInput(escalationId: esc1, reason: "Still unresolved after 1 hour", newTargetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let esc2) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        let step3 = try await handler.reEscalate(
            input: EscalationReEscalateInput(escalationId: esc2, reason: "Critical business impact", newTargetLevel: "L3"),
            storage: storage
        )
        guard case .ok(let esc3) = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }

        // All three escalation IDs should be distinct
        XCTAssertNotEqual(esc1, esc2)
        XCTAssertNotEqual(esc2, esc3)
        XCTAssertNotEqual(esc1, esc3)
    }

    // MARK: - Re-escalate then accept and resolve the new escalation

    func testReEscalateThenResolveNewEscalation() async throws {
        // After re-escalation, the new escalation should be independently resolvable
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-re-resolve", stepId: "step-rr", reason: "Slow processing", targetLevel: "L1"),
            storage: storage
        )
        guard case .ok(let esc1) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.reEscalate(
            input: EscalationReEscalateInput(escalationId: esc1, reason: "Unresolved", newTargetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let esc2) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        let step3 = try await handler.accept(
            input: EscalationAcceptInput(escalationId: esc2, acceptedBy: "senior-lead"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok on accept, got \(step3)")
        }

        let step4 = try await handler.resolve(
            input: EscalationResolveInput(escalationId: esc2, resolution: "Root cause identified and fixed"),
            storage: storage
        )
        if case .ok = step4 {
            // success
        } else {
            XCTFail("Expected .ok on resolve, got \(step4)")
        }
    }

    // MARK: - Multiple escalations for different steps

    func testMultipleEscalationsForDifferentSteps() async throws {
        // Different steps in the same process can have independent escalations
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-multi-step-esc"

        let r1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: processId, stepId: "step-validate", reason: "Validation stuck", targetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let escA) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.escalate(
            input: EscalationEscalateInput(processId: processId, stepId: "step-approve", reason: "Approval delayed", targetLevel: "L3"),
            storage: storage
        )
        guard case .ok(let escB) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(escA, escB)

        // Resolve A, leave B pending
        let _ = try await handler.accept(
            input: EscalationAcceptInput(escalationId: escA, acceptedBy: "lead-a"),
            storage: storage
        )
        let _ = try await handler.resolve(
            input: EscalationResolveInput(escalationId: escA, resolution: "Fixed"),
            storage: storage
        )
    }

    // MARK: - Escalation with various target levels

    func testEscalationWithVariousTargetLevels() async throws {
        // Escalations at different levels should all be created successfully
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let levels = ["L1", "L2", "L3", "executive"]
        var ids: Set<String> = []

        for (i, level) in levels.enumerated() {
            let result = try await handler.escalate(
                input: EscalationEscalateInput(processId: "proc-levels", stepId: "step-\(i)", reason: "Reason for \(level)", targetLevel: level),
                storage: storage
            )
            guard case .ok(let escId) = result else {
                XCTFail("Expected .ok for level \(level), got \(result)")
                return
            }
            ids.insert(escId)
        }
        XCTAssertEqual(ids.count, levels.count, "All escalation IDs should be unique")
    }

    // MARK: - Accept without resolve

    func testAcceptWithoutResolve() async throws {
        // An escalation can be accepted without immediately resolving
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-accept-only", stepId: "step-ao", reason: "Needs attention", targetLevel: "L2"),
            storage: storage
        )
        guard case .ok(let escalationId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.accept(
            input: EscalationAcceptInput(escalationId: escalationId, acceptedBy: "on-call-engineer"),
            storage: storage
        )
        if case .ok = step2 {
            // success - escalation is now accepted but not yet resolved
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Unique escalation IDs

    func testEachEscalateReturnsUniqueId() async throws {
        // Each escalation should have a unique identifier
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var ids: Set<String> = []
        for i in 1...6 {
            let result = try await handler.escalate(
                input: EscalationEscalateInput(processId: "proc-uniq-\(i)", stepId: "step-\(i)", reason: "Reason \(i)", targetLevel: "L1"),
                storage: storage
            )
            guard case .ok(let id) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(id)
        }
        XCTAssertEqual(ids.count, 6, "All 6 escalation IDs should be unique")
    }

    // MARK: - Resolution with detailed description

    func testResolveWithDetailedResolution() async throws {
        // Resolve should accept detailed resolution descriptions
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.escalate(
            input: EscalationEscalateInput(processId: "proc-detail", stepId: "step-det", reason: "System failure", targetLevel: "L3"),
            storage: storage
        )
        guard case .ok(let escalationId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.accept(
            input: EscalationAcceptInput(escalationId: escalationId, acceptedBy: "incident-commander"),
            storage: storage
        )

        let detailedResolution = "Root cause: database connection pool exhaustion due to leaked connections in the payment service. Fix: deployed hotfix v2.3.1 with connection pool recycling. Monitoring confirmed resolution at 14:30 UTC."

        let step3 = try await handler.resolve(
            input: EscalationResolveInput(escalationId: escalationId, resolution: detailedResolution),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
