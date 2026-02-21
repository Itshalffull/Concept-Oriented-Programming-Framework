// TagTests.swift — Tests for Tag concept

import XCTest
@testable import COPF

final class TagTests: XCTestCase {

    // MARK: - add

    func testAddTag() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        let result = try await handler.add(
            input: TagAddInput(tag: "swift", article: "article-1"),
            storage: storage
        )

        if case .ok(let tag) = result {
            XCTAssertEqual(tag, "swift")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddTagStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        _ = try await handler.add(
            input: TagAddInput(tag: "rust", article: "article-2"),
            storage: storage
        )

        let record = try await storage.get(relation: "tag", key: "rust")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["name"] as? String, "rust")
    }

    func testAddTagMultipleArticles() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        _ = try await handler.add(
            input: TagAddInput(tag: "programming", article: "a1"),
            storage: storage
        )
        _ = try await handler.add(
            input: TagAddInput(tag: "programming", article: "a2"),
            storage: storage
        )

        let record = try await storage.get(relation: "tag", key: "programming")
        let articles = record?["articles"] as? [String]
        XCTAssertNotNil(articles)
        XCTAssertTrue(articles?.contains("a1") ?? false)
        XCTAssertTrue(articles?.contains("a2") ?? false)
    }

    func testAddTagDuplicateArticle() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        _ = try await handler.add(
            input: TagAddInput(tag: "swift", article: "a1"),
            storage: storage
        )
        _ = try await handler.add(
            input: TagAddInput(tag: "swift", article: "a1"),
            storage: storage
        )

        let record = try await storage.get(relation: "tag", key: "swift")
        let articles = record?["articles"] as? [String]
        XCTAssertEqual(articles?.count, 1)
    }

    // MARK: - remove

    func testRemoveTag() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        _ = try await handler.add(
            input: TagAddInput(tag: "swift", article: "a1"),
            storage: storage
        )

        let result = try await handler.remove(
            input: TagRemoveInput(tag: "swift", article: "a1"),
            storage: storage
        )

        if case .ok(let tag) = result {
            XCTAssertEqual(tag, "swift")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "tag", key: "swift")
        let articles = record?["articles"] as? [String]
        XCTAssertEqual(articles?.count, 0)
    }

    func testRemoveTagFromMultiple() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        _ = try await handler.add(
            input: TagAddInput(tag: "swift", article: "a1"),
            storage: storage
        )
        _ = try await handler.add(
            input: TagAddInput(tag: "swift", article: "a2"),
            storage: storage
        )

        _ = try await handler.remove(
            input: TagRemoveInput(tag: "swift", article: "a1"),
            storage: storage
        )

        let record = try await storage.get(relation: "tag", key: "swift")
        let articles = record?["articles"] as? [String]
        XCTAssertEqual(articles?.count, 1)
        XCTAssertTrue(articles?.contains("a2") ?? false)
    }

    // MARK: - list

    func testListTags() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        _ = try await handler.add(
            input: TagAddInput(tag: "swift", article: "a1"),
            storage: storage
        )
        _ = try await handler.add(
            input: TagAddInput(tag: "rust", article: "a2"),
            storage: storage
        )

        let result = try await handler.list(
            input: TagListInput(),
            storage: storage
        )

        if case .ok(let tags) = result {
            XCTAssertTrue(tags.contains("swift"))
            XCTAssertTrue(tags.contains("rust"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListTagsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = TagHandlerImpl()

        let result = try await handler.list(
            input: TagListInput(),
            storage: storage
        )

        if case .ok(let tags) = result {
            XCTAssertEqual(tags, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
