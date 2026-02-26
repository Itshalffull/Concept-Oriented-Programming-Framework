// generated: Renderer/ConformanceTests.swift

import XCTest
@testable import Clef

final class RendererConformanceTests: XCTestCase {

    func testRendererInvariant1() async throws {
        // invariant 1: after render, render behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"

        // --- AFTER clause ---
        // render(renderer: r, tree: "<page><header/><body/></page>") -> ok(output: _)
        let step1 = try await handler.render(
            input: RendererRenderInput(renderer: r, tree: "<page><header/><body/></page>"),
            storage: storage
        )
        if case .ok(let output) = step1 {
            XCTAssertEqual(output, _)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // render(renderer: r, tree: "<page><header/><body/></page>") -> ok(output: _)
        let step2 = try await handler.render(
            input: RendererRenderInput(renderer: r, tree: "<page><header/><body/></page>"),
            storage: storage
        )
        if case .ok(let output) = step2 {
            XCTAssertEqual(output, _)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testRendererInvariant2() async throws {
        // invariant 2: after autoPlaceholder, render behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"
        let p = "u-test-invariant-002"

        // --- AFTER clause ---
        // autoPlaceholder(renderer: r, name: "sidebar") -> ok(placeholder: p)
        let step1 = try await handler.autoPlaceholder(
            input: RendererAutoPlaceholderInput(renderer: r, name: "sidebar"),
            storage: storage
        )
        if case .ok(let placeholder) = step1 {
            XCTAssertEqual(placeholder, p)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // render(renderer: r, tree: p) -> ok(output: _)
        let step2 = try await handler.render(
            input: RendererRenderInput(renderer: r, tree: p),
            storage: storage
        )
        if case .ok(let output) = step2 {
            XCTAssertEqual(output, _)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
