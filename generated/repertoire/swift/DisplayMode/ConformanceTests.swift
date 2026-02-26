// generated: DisplayMode/ConformanceTests.swift

import XCTest
@testable import COPF

final class DisplayModeConformanceTests: XCTestCase {

    func testDisplayModeInvariant1() async throws {
        // invariant 1: after defineMode, configureFieldDisplay behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let d = "u-test-invariant-001"

        // --- AFTER clause ---
        // defineMode(mode: d, name: "teaser") -> ok(mode: d)
        let step1 = try await handler.defineMode(
            input: DisplayModeDefineModeInput(mode: d, name: "teaser"),
            storage: storage
        )
        if case .ok(let mode) = step1 {
            XCTAssertEqual(mode, d)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // configureFieldDisplay(mode: d, field: "title", config: "truncated") -> ok(mode: d)
        let step2 = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(mode: d, field: "title", config: "truncated"),
            storage: storage
        )
        if case .ok(let mode) = step2 {
            XCTAssertEqual(mode, d)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testDisplayModeInvariant2() async throws {
        // invariant 2: after configureFieldDisplay, renderInMode behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let d = "u-test-invariant-001"

        // --- AFTER clause ---
        // configureFieldDisplay(mode: d, field: "title", config: "truncated") -> ok(mode: d)
        let step1 = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(mode: d, field: "title", config: "truncated"),
            storage: storage
        )
        if case .ok(let mode) = step1 {
            XCTAssertEqual(mode, d)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // renderInMode(mode: d, entity: "article-1") -> ok(output: _)
        let step2 = try await handler.renderInMode(
            input: DisplayModeRenderInModeInput(mode: d, entity: "article-1"),
            storage: storage
        )
        if case .ok(let output) = step2 {
            XCTAssertEqual(output, _)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
