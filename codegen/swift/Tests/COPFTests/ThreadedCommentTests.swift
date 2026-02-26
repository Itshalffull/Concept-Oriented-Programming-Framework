// ThreadedCommentTests.swift — Tests for ThreadedComment concept

import XCTest
@testable import Clef

final class ThreadedCommentTests: XCTestCase {

    // MARK: - addComment

    func testAddComment() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "Great post!", author: "alice"),
            storage: storage
        )

        if case .ok(let commentId) = result {
            XCTAssertFalse(commentId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddCommentStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "Hello", author: "bob"),
            storage: storage
        )

        if case .ok(let commentId) = result {
            let record = try await storage.get(relation: "threaded_comment", key: commentId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["hostNodeId"] as? String, "page1")
            XCTAssertEqual(record?["content"] as? String, "Hello")
            XCTAssertEqual(record?["author"] as? String, "bob")
            XCTAssertEqual(record?["parentCommentId"] as? String, "")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddMultipleComments() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result1 = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "First", author: "alice"),
            storage: storage
        )
        let result2 = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "Second", author: "bob"),
            storage: storage
        )

        guard case .ok(let id1) = result1, case .ok(let id2) = result2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - reply

    func testReply() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let addResult = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "Original", author: "alice"),
            storage: storage
        )
        guard case .ok(let parentId) = addResult else {
            return XCTFail("Expected .ok on addComment")
        }

        let result = try await handler.reply(
            input: ThreadedCommentReplyInput(parentCommentId: parentId, content: "Reply!", author: "bob"),
            storage: storage
        )

        if case .ok(let commentId) = result {
            XCTAssertFalse(commentId.isEmpty)
            let record = try await storage.get(relation: "threaded_comment", key: commentId)
            XCTAssertEqual(record?["parentCommentId"] as? String, parentId)
            XCTAssertEqual(record?["hostNodeId"] as? String, "page1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testReplyParentNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result = try await handler.reply(
            input: ThreadedCommentReplyInput(parentCommentId: "nonexistent", content: "Reply", author: "bob"),
            storage: storage
        )

        if case .parentNotfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .parentNotfound but got \(result)")
        }
    }

    // MARK: - publish

    func testPublish() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let addResult = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "Draft", author: "alice"),
            storage: storage
        )
        guard case .ok(let commentId) = addResult else {
            return XCTFail("Expected .ok on addComment")
        }

        let result = try await handler.publish(
            input: ThreadedCommentPublishInput(commentId: commentId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, commentId)
            let record = try await storage.get(relation: "threaded_comment", key: commentId)
            XCTAssertEqual(record?["published"] as? Bool, true)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testPublishNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result = try await handler.publish(
            input: ThreadedCommentPublishInput(commentId: "nonexistent"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - unpublish

    func testUnpublish() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let addResult = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "Content", author: "alice"),
            storage: storage
        )
        guard case .ok(let commentId) = addResult else {
            return XCTFail("Expected .ok on addComment")
        }

        _ = try await handler.publish(
            input: ThreadedCommentPublishInput(commentId: commentId),
            storage: storage
        )

        let result = try await handler.unpublish(
            input: ThreadedCommentUnpublishInput(commentId: commentId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, commentId)
            let record = try await storage.get(relation: "threaded_comment", key: commentId)
            XCTAssertEqual(record?["published"] as? Bool, false)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUnpublishNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result = try await handler.unpublish(
            input: ThreadedCommentUnpublishInput(commentId: "nonexistent"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - deleteComment

    func testDeleteComment() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let addResult = try await handler.addComment(
            input: ThreadedCommentAddCommentInput(hostNodeId: "page1", content: "To delete", author: "alice"),
            storage: storage
        )
        guard case .ok(let commentId) = addResult else {
            return XCTFail("Expected .ok on addComment")
        }

        let result = try await handler.deleteComment(
            input: ThreadedCommentDeleteCommentInput(commentId: commentId),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, commentId)
            let record = try await storage.get(relation: "threaded_comment", key: commentId)
            XCTAssertNil(record)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDeleteCommentNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ThreadedCommentHandlerImpl()

        let result = try await handler.deleteComment(
            input: ThreadedCommentDeleteCommentInput(commentId: "nonexistent"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
