// generated: Comment/ConformanceTests.swift

import XCTest
@testable import COPF

final class CommentConformanceTests: XCTestCase {

    func testCommentInvariant1() async throws {
        // invariant 1: after addComment, reply behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let e = "u-test-invariant-002"
        let r = "u-test-invariant-003"

        // --- AFTER clause ---
        // addComment(comment: c, entity: e, content: "Hello", author: "alice") -> ok(comment: c)
        let step1 = try await handler.addComment(
            input: CommentAddCommentInput(comment: c, entity: e, content: "Hello", author: "alice"),
            storage: storage
        )
        if case .ok(let comment) = step1 {
            XCTAssertEqual(comment, c)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // reply(comment: r, parent: c, content: "Reply", author: "bob") -> ok(comment: r)
        let step2 = try await handler.reply(
            input: CommentReplyInput(comment: r, parent: c, content: "Reply", author: "bob"),
            storage: storage
        )
        if case .ok(let comment) = step2 {
            XCTAssertEqual(comment, r)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
