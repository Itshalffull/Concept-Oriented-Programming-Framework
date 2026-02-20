// generated: Article/ConformanceTests.swift

import XCTest
@testable import COPF

final class ArticleConformanceTests: XCTestCase {

    func testArticleInvariant1() async throws {
        // invariant 1: after create, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let a = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(article: a, title: "Test Article", description: "A test", body: "Body text", author: "u1") -> ok(article: a)
        let step1 = try await handler.create(
            input: ArticleCreateInput(article: a, title: "Test Article", description: "A test", body: "Body text", author: "u1"),
            storage: storage
        )
        if case .ok(let article) = step1 {
            XCTAssertEqual(article, a)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // get(article: a) -> ok(article: a, slug: "test-article", title: "Test Article", description: "A test", body: "Body text", author: "u1")
        let step2 = try await handler.get(
            input: ArticleGetInput(article: a),
            storage: storage
        )
        if case .ok(let article, let slug, let title, let description, let body, let author) = step2 {
            XCTAssertEqual(article, a)
            XCTAssertEqual(slug, "test-article")
            XCTAssertEqual(title, "Test Article")
            XCTAssertEqual(description, "A test")
            XCTAssertEqual(body, "Body text")
            XCTAssertEqual(author, "u1")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testArticleInvariant2() async throws {
        // invariant 2: after create, delete behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let a = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(article: a, title: "To Delete", description: "Desc", body: "Body", author: "u1") -> ok(article: a)
        let step1 = try await handler.create(
            input: ArticleCreateInput(article: a, title: "To Delete", description: "Desc", body: "Body", author: "u1"),
            storage: storage
        )
        if case .ok(let article) = step1 {
            XCTAssertEqual(article, a)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // delete(article: a) -> ok(article: a)
        let step2 = try await handler.delete(
            input: ArticleDeleteInput(article: a),
            storage: storage
        )
        if case .ok(let article) = step2 {
            XCTAssertEqual(article, a)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
