// generated: SyncEngine/ConformanceTests.swift

import XCTest
@testable import COPF

final class SyncEngineConformanceTests: XCTestCase {

    func testSyncEngineInvariant1() async throws {
        // invariant 1: after registerSync, onCompletion behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let inv = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerSync(sync: ["name": "TestSync", "annotations": ["eager"], "when": [["concept": "urn:copf/Test", "action": "act", "inputFields": [], "outputFields": []]], "where": [], "then": [["concept": "urn:copf/Other", "action": "do", "fields": []]]]) -> ok()
        let step1 = try await handler.registerSync(
            input: SyncEngineRegisterSyncInput(sync: ["name": "TestSync", "annotations": ["eager"], "when": [["concept": "urn:copf/Test", "action": "act", "inputFields": [], "outputFields": []]], "where": [], "then": [["concept": "urn:copf/Other", "action": "do", "fields": []]]]),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // onCompletion(completion: ["id": "c1", "concept": "urn:copf/Test", "action": "act", "input": [], "variant": "ok", "output": [], "flow": "f1", "timestamp": "2024-01-01T00:00:00Z"]) -> ok(invocations: inv)
        let step2 = try await handler.onCompletion(
            input: SyncEngineOnCompletionInput(completion: ["id": "c1", "concept": "urn:copf/Test", "action": "act", "input": [], "variant": "ok", "output": [], "flow": "f1", "timestamp": "2024-01-01T00:00:00Z"]),
            storage: storage
        )
        if case .ok(let invocations) = step2 {
            XCTAssertEqual(invocations, inv)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
