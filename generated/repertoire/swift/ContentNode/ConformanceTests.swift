// generated: ContentNode/ConformanceTests.swift

import XCTest
@testable import COPF

final class ContentNodeConformanceTests: XCTestCase {

    func testContentNodeInvariant1() async throws {
        // invariant 1: after create, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(node: x, type: "page", content: "Hello", createdBy: "user1") -> ok(node: x)
        let step1 = try await handler.create(
            input: ContentNodeCreateInput(node: x, type: "page", content: "Hello", createdBy: "user1"),
            storage: storage
        )
        if case .ok(let node) = step1 {
            XCTAssertEqual(node, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // get(node: x) -> ok(node: x, type: "page", content: "Hello", metadata: "")
        let step2 = try await handler.get(
            input: ContentNodeGetInput(node: x),
            storage: storage
        )
        if case .ok(let node, let type, let content, let metadata) = step2 {
            XCTAssertEqual(node, x)
            XCTAssertEqual(type, "page")
            XCTAssertEqual(content, "Hello")
            XCTAssertEqual(metadata, "")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testContentNodeInvariant2() async throws {
        // invariant 2: after create, create behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(node: x, type: "page", content: "Hello", createdBy: "user1") -> ok(node: x)
        let step1 = try await handler.create(
            input: ContentNodeCreateInput(node: x, type: "page", content: "Hello", createdBy: "user1"),
            storage: storage
        )
        if case .ok(let node) = step1 {
            XCTAssertEqual(node, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // create(node: x, type: "page", content: "Again", createdBy: "user2") -> exists(message: "already exists")
        let step2 = try await handler.create(
            input: ContentNodeCreateInput(node: x, type: "page", content: "Again", createdBy: "user2"),
            storage: storage
        )
        if case .exists(let message) = step2 {
            XCTAssertEqual(message, "already exists")
        } else {
            XCTFail("Expected .exists, got \(step2)")
        }
    }

}
