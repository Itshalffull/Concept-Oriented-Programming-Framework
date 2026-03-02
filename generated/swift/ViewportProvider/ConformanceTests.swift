// generated: ViewportProvider/ConformanceTests.swift

import XCTest
@testable import Clef

final class ViewportProviderConformanceTests: XCTestCase {

    func testViewportProviderInitializeIdempotent() async throws {
        // invariant: calling initialize twice returns alreadyInitialized on second call
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let pluginRef = "surface-provider:viewport"

        // --- AFTER clause ---
        let step1 = try await handler.initialize(
            input: ViewportProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .ok(let ref) = step1 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.initialize(
            input: ViewportProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )
        if case .alreadyInitialized(let ref) = step2 {
            XCTAssertEqual(ref, pluginRef)
        } else {
            XCTFail("Expected .alreadyInitialized, got \(step2)")
        }
    }

    func testViewportProviderObserveReturnsBreakpoint() async throws {
        // invariant: after initialize, observe returns a matching breakpoint
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let pluginRef = "surface-provider:viewport"

        // --- AFTER clause ---
        let _ = try await handler.initialize(
            input: ViewportProviderInitializeInput(pluginRef: pluginRef),
            storage: storage
        )

        // --- THEN clause ---
        let step2 = try await handler.observe(
            input: ViewportProviderObserveInput(width: 800, height: 600),
            storage: storage
        )
        if case .ok(let breakpoint) = step2 {
            XCTAssertFalse(breakpoint.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testViewportProviderSetBreakpointsUpdatesCount() async throws {
        // invariant: setBreakpoints returns the count of breakpoints set
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.setBreakpoints(
            input: ViewportProviderSetBreakpointsInput(breakpoints: ["mobile:0:767", "tablet:768:1023", "desktop:1024:99999"]),
            storage: storage
        )
        if case .ok(let count) = step1 {
            XCTAssertEqual(count, 3)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        let step2 = try await handler.getBreakpoint(
            input: ViewportProviderGetBreakpointInput(width: 500),
            storage: storage
        )
        if case .ok(let breakpoint, _, _) = step2 {
            XCTAssertEqual(breakpoint, "mobile")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
