// generated: ProcessSpec/BusinessTests.swift

import XCTest
@testable import Clef

final class ProcessSpecBusinessTests: XCTestCase {

    // MARK: - Update semantics

    func testUpdateDraftSpecPreservesName() async throws {
        // Updating a draft spec's definition should preserve other fields
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "InvoiceFlow", version: "1.0", definition: "{\"steps\":[]}"),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.update(
            input: ProcessSpecUpdateInput(specId: specId, definition: "{\"steps\":[\"validate\"]}"),
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
        if case .ok(let name, let version, let definition, let status) = step3 {
            XCTAssertEqual(name, "InvoiceFlow")
            XCTAssertEqual(version, "1.0")
            XCTAssertEqual(definition, "{\"steps\":[\"validate\"]}")
            XCTAssertEqual(status, "draft")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testMultipleUpdatesRetainLatestDefinition() async throws {
        // Successive updates should always reflect the most recent definition
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "ShippingFlow", version: "1.0", definition: "v1"),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.update(
            input: ProcessSpecUpdateInput(specId: specId, definition: "v2"),
            storage: storage
        )
        let _ = try await handler.update(
            input: ProcessSpecUpdateInput(specId: specId, definition: "v3"),
            storage: storage
        )

        let step4 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(_, _, let definition, _) = step4 {
            XCTAssertEqual(definition, "v3")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Lifecycle transitions

    func testPublishThenDeprecateLifecycle() async throws {
        // A spec can move from draft -> published -> deprecated
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "RefundFlow", version: "3.0", definition: "{}"),
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

        let step3 = try await handler.deprecate(
            input: ProcessSpecDeprecateInput(specId: specId, reason: "replaced by v4"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        let step4 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(_, _, _, let status) = step4 {
            XCTAssertEqual(status, "deprecated")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Isolation between specs

    func testMultipleSpecsAreIsolated() async throws {
        // Creating multiple specs should not cause cross-contamination
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "FlowA", version: "1.0", definition: "{\"a\":true}"),
            storage: storage
        )
        guard case .ok(let specIdA) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.create(
            input: ProcessSpecCreateInput(name: "FlowB", version: "2.0", definition: "{\"b\":true}"),
            storage: storage
        )
        guard case .ok(let specIdB) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        XCTAssertNotEqual(specIdA, specIdB)

        let getA = try await handler.get(
            input: ProcessSpecGetInput(specId: specIdA),
            storage: storage
        )
        if case .ok(let name, let version, _, _) = getA {
            XCTAssertEqual(name, "FlowA")
            XCTAssertEqual(version, "1.0")
        } else {
            XCTFail("Expected .ok, got \(getA)")
        }

        let getB = try await handler.get(
            input: ProcessSpecGetInput(specId: specIdB),
            storage: storage
        )
        if case .ok(let name, let version, _, _) = getB {
            XCTAssertEqual(name, "FlowB")
            XCTAssertEqual(version, "2.0")
        } else {
            XCTFail("Expected .ok, got \(getB)")
        }
    }

    // MARK: - Version distinctness

    func testSameNameDifferentVersionCreatesDistinctSpecs() async throws {
        // Two specs with the same name but different versions should be independent
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "OrderFlow", version: "1.0", definition: "{\"v\":1}"),
            storage: storage
        )
        guard case .ok(let specV1) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.create(
            input: ProcessSpecCreateInput(name: "OrderFlow", version: "2.0", definition: "{\"v\":2}"),
            storage: storage
        )
        guard case .ok(let specV2) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        XCTAssertNotEqual(specV1, specV2)

        // Deprecating v1 should not affect v2
        let _ = try await handler.deprecate(
            input: ProcessSpecDeprecateInput(specId: specV1, reason: "upgraded"),
            storage: storage
        )

        let getV2 = try await handler.get(
            input: ProcessSpecGetInput(specId: specV2),
            storage: storage
        )
        if case .ok(_, _, _, let status) = getV2 {
            XCTAssertEqual(status, "draft")
        } else {
            XCTFail("Expected .ok, got \(getV2)")
        }
    }

    // MARK: - Edge cases

    func testCreateWithEmptyDefinition() async throws {
        // Creating a spec with an empty definition string should succeed
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "MinimalFlow", version: "0.1", definition: ""),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(let name, _, let definition, _) = step2 {
            XCTAssertEqual(name, "MinimalFlow")
            XCTAssertEqual(definition, "")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testDeprecateDirectlyFromDraft() async throws {
        // A draft spec can be deprecated without going through published first
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "AbandonedFlow", version: "0.0.1", definition: "{}"),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.deprecate(
            input: ProcessSpecDeprecateInput(specId: specId, reason: "never needed"),
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

    func testCreateSpecWithLargeDefinition() async throws {
        // A spec with a large definition payload should be stored and retrieved accurately
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let largeDefinition = String(repeating: "{\"step\":\"x\"},", count: 500)

        let step1 = try await handler.create(
            input: ProcessSpecCreateInput(name: "LargeFlow", version: "1.0", definition: largeDefinition),
            storage: storage
        )
        guard case .ok(let specId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.get(
            input: ProcessSpecGetInput(specId: specId),
            storage: storage
        )
        if case .ok(_, _, let definition, _) = step2 {
            XCTAssertEqual(definition, largeDefinition)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
