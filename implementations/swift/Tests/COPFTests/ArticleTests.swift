// ArticleTests.swift — Tests for Article concept

import XCTest
@testable import COPF

final class ArticleTests: XCTestCase {

    func testCreateArticle() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        let result = try await handler.create(
            input: ArticleCreateInput(
                article: "art1",
                title: "Hello World",
                description: "My first article",
                body: "This is the body.",
                author: "alice"
            ),
            storage: storage
        )

        if case .ok(let article) = result {
            XCTAssertEqual(article, "art1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateArticleSlugify() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        _ = try await handler.create(
            input: ArticleCreateInput(
                article: "art1",
                title: "Hello World! This is a Test",
                description: "desc",
                body: "body",
                author: "alice"
            ),
            storage: storage
        )

        let result = try await handler.get(
            input: ArticleGetInput(article: "art1"),
            storage: storage
        )

        if case .ok(_, let slug, _, _, _, _) = result {
            XCTAssertEqual(slug, "hello-world-this-is-a-test")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetArticle() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        _ = try await handler.create(
            input: ArticleCreateInput(
                article: "art1",
                title: "Hello World",
                description: "My first article",
                body: "This is the body.",
                author: "alice"
            ),
            storage: storage
        )

        let result = try await handler.get(
            input: ArticleGetInput(article: "art1"),
            storage: storage
        )

        if case .ok(let article, let slug, let title, let description, let body, let author) = result {
            XCTAssertEqual(article, "art1")
            XCTAssertEqual(slug, "hello-world")
            XCTAssertEqual(title, "Hello World")
            XCTAssertEqual(description, "My first article")
            XCTAssertEqual(body, "This is the body.")
            XCTAssertEqual(author, "alice")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetArticleNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        let result = try await handler.get(
            input: ArticleGetInput(article: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"), "Error should mention article id: \(message)")
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testUpdateArticle() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        _ = try await handler.create(
            input: ArticleCreateInput(
                article: "art1",
                title: "Hello World",
                description: "Original",
                body: "Original body",
                author: "alice"
            ),
            storage: storage
        )

        let updateResult = try await handler.update(
            input: ArticleUpdateInput(
                article: "art1",
                title: "Updated Title",
                description: "Updated description",
                body: "Updated body"
            ),
            storage: storage
        )

        if case .ok(let article) = updateResult {
            XCTAssertEqual(article, "art1")
        } else {
            XCTFail("Expected .ok but got \(updateResult)")
        }

        // Verify the update
        let getResult = try await handler.get(
            input: ArticleGetInput(article: "art1"),
            storage: storage
        )

        if case .ok(_, let slug, let title, let description, let body, let author) = getResult {
            XCTAssertEqual(slug, "updated-title")
            XCTAssertEqual(title, "Updated Title")
            XCTAssertEqual(description, "Updated description")
            XCTAssertEqual(body, "Updated body")
            XCTAssertEqual(author, "alice", "Author should be preserved from original")
        } else {
            XCTFail("Expected .ok but got \(getResult)")
        }
    }

    func testUpdateArticleNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        let result = try await handler.update(
            input: ArticleUpdateInput(
                article: "nonexistent",
                title: "Title",
                description: "Desc",
                body: "Body"
            ),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testDeleteArticle() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        _ = try await handler.create(
            input: ArticleCreateInput(
                article: "art1",
                title: "Hello World",
                description: "desc",
                body: "body",
                author: "alice"
            ),
            storage: storage
        )

        let deleteResult = try await handler.delete(
            input: ArticleDeleteInput(article: "art1"),
            storage: storage
        )

        if case .ok(let article) = deleteResult {
            XCTAssertEqual(article, "art1")
        } else {
            XCTFail("Expected .ok but got \(deleteResult)")
        }

        // Verify it's gone
        let getResult = try await handler.get(
            input: ArticleGetInput(article: "art1"),
            storage: storage
        )

        if case .notfound = getResult {
            // Expected
        } else {
            XCTFail("Expected .notfound after delete but got \(getResult)")
        }
    }

    func testDeleteArticleNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = ArticleHandlerImpl()

        let result = try await handler.delete(
            input: ArticleDeleteInput(article: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
