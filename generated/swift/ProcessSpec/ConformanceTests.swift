// generated: ProcessSpec/ConformanceTests.swift

import XCTest
@testable import Clef

final class ProcessSpecConformanceTests: XCTestCase {

    func testProcessSpecCreateAndGet() async throws {
        // invariant: after create, get returns the spec with draft status
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        // create(name: "OrderFlow", version: "1.0", definition: "{}") -> ok(specId: _)
        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "OrderFlow", version: "1.0", definition: "{}"),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // get(specId: specId) -> ok(name: "OrderFlow", version: "1.0", definition: "{}", status: "draft")
        let step2 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(let name, let version, _, let status) = step2 {
            XCTAssertEqual(name, "OrderFlow")
            XCTAssertEqual(version, "1.0")
            XCTAssertEqual(status, "draft")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testProcessSpecPublishAndGet() async throws {
        // invariant: after publish, get returns status "published"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "PaymentFlow", version: "2.0", definition: "{}"),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.publish(
            input: ProcessSpecPublishInput(specId: specId),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(_, _, _, let status) = step3 {
            XCTAssertEqual(status, "published")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testProcessSpecDeprecate() async throws {
        // invariant: after deprecate, get returns status "deprecated"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "LegacyFlow", version: "0.1", definition: "{}"),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.deprecate(
            input: ProcessSpecDeprecateInput(specId: specId, reason: "replaced by v2"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(_, _, _, let status) = step3 {
            XCTAssertEqual(status, "deprecated")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
