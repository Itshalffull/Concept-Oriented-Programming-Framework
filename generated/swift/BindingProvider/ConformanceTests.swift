// generated: BindingProvider/ConformanceTests.swift

import XCTest
@testable import Clef

final class BindingProviderConformanceTests: XCTestCase {

    func testBindingProviderInitializeIdempotent() async throws {
        // invariant: calling initialize twice returns alreadyInitialized on second call
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let pluginRef = "surface-provider:binding"

        // --- AFTER clause ---
        let step1 = try await handler.initialize(
            input: BindingProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .ok(let ref) = step1 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.initialize(
            input: BindingProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .alreadyInitialized(let ref) = step2 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .alreadyInitialized, got \(step2)")
        }
    }

    func testBindingProviderBindAndUnbind() async throws {
        // invariant: after bind, unbind removes the binding; double unbind returns notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let bindingId = "b-test-001"

        // --- AFTER clause ---
        let step1 = try await handler.bind(
            input: BindingProviderBindInput(bindingId: bindingId, sourceKey: "model.name", targetKey: "view.label"),
            storage: storage
        )
        if case .ok(let id) = step1 {
            XCTAssertEqual(id, bindingId)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.unbind(
            input: BindingProviderUnbindInput(bindingId: bindingId),
            storage: storage
        )
        if case .ok(let id) = step2 {
            XCTAssertEqual(id, bindingId)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // unbind again should return notFound
        let step3 = try await handler.unbind(
            input: BindingProviderUnbindInput(bindingId: bindingId),
            storage: storage
        )
        if case .notFound(let message) = step3 {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .notFound, got \(step3)")
        }
    }

    func testBindingProviderSyncAndInvoke() async throws {
        // invariant: sync and invoke on existing binding return ok; on missing binding return notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let bindingId = "b-test-002"

        // sync on non-existent binding
        let step1 = try await handler.sync(
            input: BindingProviderSyncInput(bindingId: bindingId),
            storage: storage
        )
        if case .notFound(let message) = step1 {
            XCTAssertFalse(message.isEmpty)
        } else {
            XCTFail("Expected .notFound, got \(step1)")
        }

        // --- AFTER clause ---
        let _ = try await handler.bind(
            input: BindingProviderBindInput(bindingId: bindingId, sourceKey: "state.count", targetKey: "display.text"),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.sync(
            input: BindingProviderSyncInput(bindingId: bindingId),
            storage: storage
        )
        if case .ok(let id) = step3 {
            XCTAssertEqual(id, bindingId)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        let step4 = try await handler.invoke(
            input: BindingProviderInvokeInput(bindingId: bindingId, payload: "test-payload"),
            storage: storage
        )
        if case .ok(let id, _) = step4 {
            XCTAssertEqual(id, bindingId)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

}
