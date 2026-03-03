// generated: QualitySignal/ConformanceTests.swift

import XCTest
@testable import Clef

final class QualitySignalConformanceTests: XCTestCase {

    func testQualitySignalInvariant1() async throws {
        // invariant 1: after record, latest behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let null = "u-test-invariant-001"
        let q = "u-test-invariant-002"
        let t = "u-test-invariant-003"

        // --- AFTER clause ---
        // record(target_symbol: "clef/concept/Password", dimension: "formal", status: "pass", severity: "gate", summary: "Proved 3 properties", artifact_path: null, artifact_hash: null, run_ref: "run-1") -> ok(signal: q)
        let step1 = try await handler.record(
            input: QualitySignalRecordInput(target_symbol: "clef/concept/Password", dimension: "formal", status: "pass", severity: "gate", summary: "Proved 3 properties", artifact_path: null, artifact_hash: null, run_ref: "run-1"),
            storage: storage
        )
        if case .ok(let signal) = step1 {
            XCTAssertEqual(signal, q)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // latest(target_symbol: "clef/concept/Password", dimension: "formal") -> ok(signal: q, status: "pass", severity: "gate", summary: "Proved 3 properties", observed_at: t)
        let step2 = try await handler.latest(
            input: QualitySignalLatestInput(target_symbol: "clef/concept/Password", dimension: "formal"),
            storage: storage
        )
        if case .ok(let signal, let status, let severity, let summary, let observed_at) = step2 {
            XCTAssertEqual(signal, q)
            XCTAssertEqual(status, "pass")
            XCTAssertEqual(severity, "gate")
            XCTAssertEqual(summary, "Proved 3 properties")
            XCTAssertEqual(observed_at, t)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}