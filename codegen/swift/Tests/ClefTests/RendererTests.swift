// RendererTests.swift — Tests for Renderer concept

import XCTest
@testable import Clef

final class RendererTests: XCTestCase {

    // MARK: - render

    func testRender() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result = try await handler.render(
            input: RendererRenderInput(elementId: "el1", context: "page"),
            storage: storage
        )

        if case .ok(let elementId, let output) = result {
            XCTAssertEqual(elementId, "el1")
            XCTAssertTrue(output.contains("el1"))
            XCTAssertTrue(output.contains("page"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRenderCachesResult() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        _ = try await handler.render(
            input: RendererRenderInput(elementId: "el1", context: "page"),
            storage: storage
        )

        let cached = try await storage.get(relation: "render_cache", key: "el1")
        XCTAssertNotNil(cached)
        XCTAssertEqual(cached?["elementId"] as? String, "el1")
    }

    func testRenderDifferentContexts() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result1 = try await handler.render(
            input: RendererRenderInput(elementId: "el1", context: "page"),
            storage: storage
        )
        let result2 = try await handler.render(
            input: RendererRenderInput(elementId: "el1", context: "sidebar"),
            storage: storage
        )

        if case .ok(_, let output1) = result1, case .ok(_, let output2) = result2 {
            XCTAssertTrue(output1.contains("page"))
            XCTAssertTrue(output2.contains("sidebar"))
        } else {
            XCTFail("Expected both results to be .ok")
        }
    }

    // MARK: - autoPlaceholder

    func testAutoPlaceholder() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result = try await handler.autoPlaceholder(
            input: RendererAutoPlaceholderInput(elementId: "el1"),
            storage: storage
        )

        if case .ok(let elementId, let placeholderId) = result {
            XCTAssertEqual(elementId, "el1")
            XCTAssertTrue(placeholderId.starts(with: "placeholder-"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAutoPlaceholderStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result = try await handler.autoPlaceholder(
            input: RendererAutoPlaceholderInput(elementId: "el1"),
            storage: storage
        )

        if case .ok(_, let placeholderId) = result {
            let cached = try await storage.get(relation: "render_cache", key: placeholderId)
            XCTAssertNotNil(cached)
            XCTAssertEqual(cached?["type"] as? String, "placeholder")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAutoPlaceholderUniquePlaceholderIds() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result1 = try await handler.autoPlaceholder(
            input: RendererAutoPlaceholderInput(elementId: "el1"),
            storage: storage
        )
        let result2 = try await handler.autoPlaceholder(
            input: RendererAutoPlaceholderInput(elementId: "el1"),
            storage: storage
        )

        guard case .ok(_, let pid1) = result1, case .ok(_, let pid2) = result2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(pid1, pid2)
    }

    // MARK: - mergeCacheability

    func testMergeCacheability() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result = try await handler.mergeCacheability(
            input: RendererMergeCacheabilityInput(
                parentTags: "[\"node:1\",\"user:2\"]",
                childTags: "[\"node:3\",\"user:2\"]"
            ),
            storage: storage
        )

        if case .ok(let mergedTags) = result {
            XCTAssertTrue(mergedTags.contains("node:1"))
            XCTAssertTrue(mergedTags.contains("node:3"))
            XCTAssertTrue(mergedTags.contains("user:2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testMergeCacheabilityEmptyParent() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result = try await handler.mergeCacheability(
            input: RendererMergeCacheabilityInput(
                parentTags: "[]",
                childTags: "[\"tag:a\"]"
            ),
            storage: storage
        )

        if case .ok(let mergedTags) = result {
            XCTAssertTrue(mergedTags.contains("tag:a"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testMergeCacheabilityBothEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = RendererHandlerImpl()

        let result = try await handler.mergeCacheability(
            input: RendererMergeCacheabilityInput(
                parentTags: "[]",
                childTags: "[]"
            ),
            storage: storage
        )

        if case .ok(let mergedTags) = result {
            XCTAssertEqual(mergedTags, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
