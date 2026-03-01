// generated: ProcessVariable/BusinessTests.swift

import XCTest
@testable import Clef

final class ProcessVariableBusinessTests: XCTestCase {

    // MARK: - Overwrite existing variable

    func testSetOverwritesExistingValue() async throws {
        // Setting the same key twice should overwrite the previous value
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-overwrite"

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "counter", value: "1"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "counter", value: "2"),
            storage: storage
        )

        let step3 = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "counter"),
            storage: storage
        )
        if case .ok(let value) = step3 {
            XCTAssertEqual(value, "2")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Get nonexistent key

    func testGetNonexistentKeyReturnsNotFound() async throws {
        // Getting a key that was never set should return notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.get(
            input: ProcessVariableGetInput(processId: "proc-missing", key: "nonexistent"),
            storage: storage
        )
        if case .notFound = step1 {
            // expected
        } else {
            XCTFail("Expected .notFound, got \(step1)")
        }
    }

    // MARK: - Merge behavior

    func testMergeAddsNewKeysWithoutOverwriting() async throws {
        // Merge should add new keys and update existing ones
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-merge"

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "existing", value: "original"),
            storage: storage
        )

        let step2 = try await handler.merge(
            input: ProcessVariableMergeInput(processId: processId, variables: "{\"existing\":\"updated\",\"newKey\":\"newValue\"}"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let getExisting = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "existing"),
            storage: storage
        )
        if case .ok(let value) = getExisting {
            XCTAssertEqual(value, "updated")
        } else {
            XCTFail("Expected .ok, got \(getExisting)")
        }

        let getNew = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "newKey"),
            storage: storage
        )
        if case .ok(let value) = getNew {
            XCTAssertEqual(value, "newValue")
        } else {
            XCTFail("Expected .ok, got \(getNew)")
        }
    }

    // MARK: - Process isolation for variables

    func testVariablesAreIsolatedBetweenProcesses() async throws {
        // Variables set on one process should not be visible on another
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: "proc-a", key: "secret", value: "alpha"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: "proc-b", key: "secret", value: "beta"),
            storage: storage
        )

        let getA = try await handler.get(
            input: ProcessVariableGetInput(processId: "proc-a", key: "secret"),
            storage: storage
        )
        if case .ok(let value) = getA {
            XCTAssertEqual(value, "alpha")
        } else {
            XCTFail("Expected .ok, got \(getA)")
        }

        let getB = try await handler.get(
            input: ProcessVariableGetInput(processId: "proc-b", key: "secret"),
            storage: storage
        )
        if case .ok(let value) = getB {
            XCTAssertEqual(value, "beta")
        } else {
            XCTFail("Expected .ok, got \(getB)")
        }
    }

    // MARK: - List after multiple set and delete operations

    func testListReflectsCurrentVariableKeys() async throws {
        // List should only include keys that currently exist
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-list-ops"

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "a", value: "1"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "b", value: "2"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "c", value: "3"),
            storage: storage
        )
        let _ = try await handler.delete(
            input: ProcessVariableDeleteInput(processId: processId, key: "b"),
            storage: storage
        )

        let step5 = try await handler.list(
            input: ProcessVariableListInput(processId: processId),
            storage: storage
        )
        if case .ok(let keys) = step5 {
            XCTAssertTrue(keys.contains("a"))
            XCTAssertFalse(keys.contains("b"))
            XCTAssertTrue(keys.contains("c"))
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    // MARK: - Snapshot after modifications

    func testSnapshotCapturesCurrentState() async throws {
        // Snapshot should reflect all current variables including updates
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-snapshot"

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "x", value: "10"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "y", value: "20"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "x", value: "15"),
            storage: storage
        )

        let step4 = try await handler.snapshot(
            input: ProcessVariableSnapshotInput(processId: processId),
            storage: storage
        )
        if case .ok(let snapshot) = step4 {
            XCTAssertFalse(snapshot.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Delete idempotency

    func testDeleteNonexistentKeyIsHandled() async throws {
        // Deleting a key that does not exist should not cause an error
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.delete(
            input: ProcessVariableDeleteInput(processId: "proc-del-missing", key: "no-such-key"),
            storage: storage
        )
        // Whether it returns .ok or .notFound, it should not crash
        switch step1 {
        case .ok:
            break // acceptable
        default:
            break // also acceptable depending on implementation
        }
    }

    // MARK: - Set and delete then re-set

    func testSetDeleteThenResetVariable() async throws {
        // Setting a key, deleting it, then re-setting should work correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-re-set"

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "toggle", value: "on"),
            storage: storage
        )
        let _ = try await handler.delete(
            input: ProcessVariableDeleteInput(processId: processId, key: "toggle"),
            storage: storage
        )
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "toggle", value: "off"),
            storage: storage
        )

        let step4 = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "toggle"),
            storage: storage
        )
        if case .ok(let value) = step4 {
            XCTAssertEqual(value, "off")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Empty value

    func testSetEmptyStringValue() async throws {
        // Setting a variable with an empty string value should be retrievable
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-empty-val"

        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "emptyField", value: ""),
            storage: storage
        )

        let step2 = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "emptyField"),
            storage: storage
        )
        if case .ok(let value) = step2 {
            XCTAssertEqual(value, "")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
