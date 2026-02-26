// generated: Comment/ConformanceTests.swift

import XCTest
@testable import Clef

final class CommentConformanceTests: XCTestCase {

    func testCommentInvariant1() async throws {
        // invariant 1: after create, delete behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(comment: c, body: "Great post", target: "a1", author: "u1") -> ok(comment: c)
        let step1 = try await handler.create(
            input: CommentCreateInput(comment: c, body: "Great post", target: "a1", author: "u1"),
            storage: storage
        )
        if case .ok(let comment) = step1 {
            XCTAssertEqual(comment, c)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // delete(comment: c) -> ok(comment: c)
        let step2 = try await handler.delete(
            input: CommentDeleteInput(comment: c),
            storage: storage
        )
        if case .ok(let comment) = step2 {
            XCTAssertEqual(comment, c)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
