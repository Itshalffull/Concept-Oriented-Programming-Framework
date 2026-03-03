// generated: Evidence/ConformanceTests.swift

import XCTest
@testable import Clef

final class EvidenceConformanceTests: XCTestCase {

    func testEvidenceInvariant1() async throws {
        // invariant 1: after record, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let m = "u-test-invariant-002"
        let e = "u-test-invariant-003"
        let h = "u-test-invariant-004"

        // --- AFTER clause ---
        // record(artifact_type: "proof_certificate", content: c, solver_metadata: m, property_ref: "prop-1", confidence_score: 1) -> ok(evidence: e, content_hash: h)
        let step1 = try await handler.record(
            input: EvidenceRecordInput(artifact_type: "proof_certificate", content: c, solver_metadata: m, property_ref: "prop-1", confidence_score: 1),
            storage: storage
        )
        if case .ok(let evidence, let content_hash) = step1 {
            XCTAssertEqual(evidence, e)
            XCTAssertEqual(content_hash, h)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // validate(evidence: e) -> ok(evidence: e, valid: true)
        let step2 = try await handler.validate(
            input: EvidenceValidateInput(evidence: e),
            storage: storage
        )
        if case .ok(let evidence, let valid) = step2 {
            XCTAssertEqual(evidence, e)
            XCTAssertEqual(valid, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}