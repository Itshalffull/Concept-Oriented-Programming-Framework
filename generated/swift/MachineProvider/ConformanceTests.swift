// generated: MachineProvider/ConformanceTests.swift

import XCTest
@testable import Clef

final class MachineProviderConformanceTests: XCTestCase {

    func testMachineProviderInitializeIdempotent() async throws {
        // invariant: calling initialize twice returns alreadyInitialized on second call
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let pluginRef = "surface-provider:machine"

        // --- AFTER clause ---
        let step1 = try await handler.initialize(
            input: MachineProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .ok(let ref) = step1 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.initialize(
            input: MachineProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .alreadyInitialized(let ref) = step2 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .alreadyInitialized, got \(step2)")
        }
    }

    func testMachineProviderSpawnAndSend() async throws {
        // invariant: after spawn, send transitions state; send on missing machine returns notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let machineId = "m-test-001"

        // --- AFTER clause ---
        let step1 = try await handler.spawn(
            input: MachineProviderSpawnInput(machineId: machineId, initialState: "idle"),
            storage: storage
        )
        if case .ok(let id, let state) = step1 {
            XCTAssertEqual(id, machineId)
            XCTAssertEqual(state, "idle")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.send(
            input: MachineProviderSendInput(machineId: machineId, event: "start"),
            storage: storage
        )
        if case .ok(let id, let prev, _) = step2 {
            XCTAssertEqual(id, machineId)
            XCTAssertEqual(prev, "idle")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // send to non-existent machine
        let step3 = try await handler.send(
            input: MachineProviderSendInput(machineId: "no-such-machine", event: "start"),
            storage: storage
        )
        if case .notFound(let message) = step3 {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .notFound, got \(step3)")
        }
    }

    func testMachineProviderConnectAndDestroy() async throws {
        // invariant: connect requires both machines to exist; destroy removes the machine
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let machineA = "m-test-002a"
        let machineB = "m-test-002b"

        // --- AFTER clause ---
        let _ = try await handler.spawn(
            input: MachineProviderSpawnInput(machineId: machineA, initialState: "idle"),
            storage: storage
        )
        let _ = try await handler.spawn(
            input: MachineProviderSpawnInput(machineId: machineB, initialState: "waiting"),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.connect(
            input: MachineProviderConnectInput(sourceMachineId: machineA, targetMachineId: machineB, event: "notify"),
            storage: storage
        )
        if case .ok(let connectionId) = step3 {
            XCTAssertFalse(connectionId.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        // destroy machineA
        let step4 = try await handler.destroy(
            input: MachineProviderDestroyInput(machineId: machineA),
            storage: storage
        )
        if case .ok(let id) = step4 {
            XCTAssertEqual(id, machineA)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }

        // destroy again returns notFound
        let step5 = try await handler.destroy(
            input: MachineProviderDestroyInput(machineId: machineA),
            storage: storage
        )
        if case .notFound(let message) = step5 {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .notFound, got \(step5)")
        }
    }

}
