// FavoriteTests.swift — Tests for Favorite concept

import XCTest
@testable import COPF

final class FavoriteTests: XCTestCase {

    // MARK: - favorite

    func testFavorite() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        let result = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        if case .ok(let user, let article) = result {
            XCTAssertEqual(user, "u1")
            XCTAssertEqual(article, "a1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testFavoriteStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        let record = try await storage.get(relation: "favorite", key: "u1")
        XCTAssertNotNil(record)
        let articles = record?["articles"] as? [String]
        XCTAssertTrue(articles?.contains("a1") ?? false)
    }

    func testFavoriteMultipleArticles() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )
        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a2"),
            storage: storage
        )

        let record = try await storage.get(relation: "favorite", key: "u1")
        let articles = record?["articles"] as? [String]
        XCTAssertEqual(articles?.count, 2)
    }

    func testFavoriteDuplicateIgnored() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )
        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        let record = try await storage.get(relation: "favorite", key: "u1")
        let articles = record?["articles"] as? [String]
        XCTAssertEqual(articles?.count, 1)
    }

    // MARK: - unfavorite

    func testUnfavorite() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        let result = try await handler.unfavorite(
            input: FavoriteUnfavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        if case .ok(let user, let article) = result {
            XCTAssertEqual(user, "u1")
            XCTAssertEqual(article, "a1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUnfavoriteRemovesFromStorage() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )
        _ = try await handler.unfavorite(
            input: FavoriteUnfavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        let record = try await storage.get(relation: "favorite", key: "u1")
        let articles = record?["articles"] as? [String]
        XCTAssertEqual(articles?.count, 0)
    }

    // MARK: - isFavorited

    func testIsFavoritedTrue() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )

        let result = try await handler.isFavorited(
            input: FavoriteIsFavoritedInput(user: "u1", article: "a1"),
            storage: storage
        )

        if case .ok(let favorited) = result {
            XCTAssertTrue(favorited)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testIsFavoritedFalse() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        let result = try await handler.isFavorited(
            input: FavoriteIsFavoritedInput(user: "u1", article: "a1"),
            storage: storage
        )

        if case .ok(let favorited) = result {
            XCTAssertFalse(favorited)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - count

    func testCount() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u1", article: "a1"),
            storage: storage
        )
        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u2", article: "a1"),
            storage: storage
        )
        _ = try await handler.favorite(
            input: FavoriteFavoriteInput(user: "u3", article: "a1"),
            storage: storage
        )

        let result = try await handler.count(
            input: FavoriteCountInput(article: "a1"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 3)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCountZero() async throws {
        let storage = InMemoryStorage()
        let handler = FavoriteHandlerImpl()

        let result = try await handler.count(
            input: FavoriteCountInput(article: "nonexistent"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
