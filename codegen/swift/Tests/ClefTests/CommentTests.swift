// CommentTests.swift — Tests for Comment concept

import XCTest
@testable import Clef

final class CommentTests: XCTestCase {

    // MARK: - create

    func testCreateComment() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        let result = try await handler.create(
            input: CommentCreateInput(comment: "c1", body: "Great article!", target: "article-1", author: "user-1"),
            storage: storage
        )

        if case .ok(let comment) = result {
            XCTAssertEqual(comment, "c1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateCommentStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        _ = try await handler.create(
            input: CommentCreateInput(comment: "c1", body: "Nice work!", target: "article-1", author: "user-2"),
            storage: storage
        )

        let record = try await storage.get(relation: "comment", key: "c1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["body"] as? String, "Nice work!")
        XCTAssertEqual(record?["target"] as? String, "article-1")
        XCTAssertEqual(record?["author"] as? String, "user-2")
    }

    func testCreateMultipleComments() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        _ = try await handler.create(
            input: CommentCreateInput(comment: "c1", body: "First", target: "a1", author: "u1"),
            storage: storage
        )
        _ = try await handler.create(
            input: CommentCreateInput(comment: "c2", body: "Second", target: "a1", author: "u2"),
            storage: storage
        )

        let comments = try await storage.find(relation: "comment", criteria: ["target": "a1"])
        XCTAssertEqual(comments.count, 2)
    }

    // MARK: - delete

    func testDeleteComment() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        _ = try await handler.create(
            input: CommentCreateInput(comment: "c1", body: "To delete", target: "a1", author: "u1"),
            storage: storage
        )

        let result = try await handler.delete(
            input: CommentDeleteInput(comment: "c1"),
            storage: storage
        )

        if case .ok(let comment) = result {
            XCTAssertEqual(comment, "c1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        // Verify deletion
        let record = try await storage.get(relation: "comment", key: "c1")
        XCTAssertNil(record)
    }

    func testDeleteCommentNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        let result = try await handler.delete(
            input: CommentDeleteInput(comment: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - list

    func testListComments() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        _ = try await handler.create(
            input: CommentCreateInput(comment: "c1", body: "Hello", target: "a1", author: "u1"),
            storage: storage
        )
        _ = try await handler.create(
            input: CommentCreateInput(comment: "c2", body: "World", target: "a1", author: "u2"),
            storage: storage
        )

        let result = try await handler.list(
            input: CommentListInput(target: "a1"),
            storage: storage
        )

        if case .ok(let comments) = result {
            XCTAssertTrue(comments.contains("c1"))
            XCTAssertTrue(comments.contains("c2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListCommentsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        let result = try await handler.list(
            input: CommentListInput(target: "no-comments"),
            storage: storage
        )

        if case .ok(let comments) = result {
            XCTAssertEqual(comments, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListCommentsFiltersByTarget() async throws {
        let storage = InMemoryStorage()
        let handler = CommentHandlerImpl()

        _ = try await handler.create(
            input: CommentCreateInput(comment: "c1", body: "On A1", target: "a1", author: "u1"),
            storage: storage
        )
        _ = try await handler.create(
            input: CommentCreateInput(comment: "c2", body: "On A2", target: "a2", author: "u1"),
            storage: storage
        )

        let result = try await handler.list(
            input: CommentListInput(target: "a2"),
            storage: storage
        )

        if case .ok(let comments) = result {
            XCTAssertTrue(comments.contains("c2"))
            XCTAssertFalse(comments.contains("c1"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
