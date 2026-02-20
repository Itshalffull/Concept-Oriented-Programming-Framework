// generated: Favorite/ConformanceTests.swift

import XCTest
@testable import COPF

final class FavoriteConformanceTests: XCTestCase {

    func testFavoriteInvariant1() async throws {
        // invariant 1: after favorite, isFavorited, unfavorite behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let u = "u-test-invariant-001"

        // --- AFTER clause ---
        // favorite(user: u, article: "a1") -> ok(user: u, article: "a1")
        let step1 = try await handler.favorite(
            input: FavoriteFavoriteInput(user: u, article: "a1"),
            storage: storage
        )
        if case .ok(let user, let article) = step1 {
            XCTAssertEqual(user, u)
            XCTAssertEqual(article, "a1")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // isFavorited(user: u, article: "a1") -> ok(favorited: true)
        let step2 = try await handler.isFavorited(
            input: FavoriteIsFavoritedInput(user: u, article: "a1"),
            storage: storage
        )
        if case .ok(let favorited) = step2 {
            XCTAssertEqual(favorited, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // unfavorite(user: u, article: "a1") -> ok(user: u, article: "a1")
        let step3 = try await handler.unfavorite(
            input: FavoriteUnfavoriteInput(user: u, article: "a1"),
            storage: storage
        )
        if case .ok(let user, let article) = step3 {
            XCTAssertEqual(user, u)
            XCTAssertEqual(article, "a1")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
