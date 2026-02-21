// CacheTests.swift — Tests for Cache concept

import XCTest
@testable import COPF

final class CacheTests: XCTestCase {

    // MARK: - set

    func testCacheSet() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        let result = try await handler.set(
            input: CacheSetInput(key: "k1", value: "v1", tags: "tag1,tag2", maxAge: 300),
            storage: storage
        )

        if case .ok(let key) = result {
            XCTAssertEqual(key, "k1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCacheSetStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "cached-data", tags: "t1", maxAge: 60),
            storage: storage
        )

        let record = try await storage.get(relation: "cache_bin", key: "k1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["value"] as? String, "cached-data")
        XCTAssertEqual(record?["tags"] as? String, "t1")
    }

    // MARK: - get

    func testCacheGetHit() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "hello", tags: "", maxAge: 300),
            storage: storage
        )

        let result = try await handler.get(
            input: CacheGetInput(key: "k1"),
            storage: storage
        )

        if case .ok(let key, let value) = result {
            XCTAssertEqual(key, "k1")
            XCTAssertEqual(value, "hello")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCacheGetMiss() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        let result = try await handler.get(
            input: CacheGetInput(key: "nonexistent"),
            storage: storage
        )

        if case .miss(let key) = result {
            XCTAssertEqual(key, "nonexistent")
        } else {
            XCTFail("Expected .miss but got \(result)")
        }
    }

    func testCacheGetAfterOverwrite() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "old", tags: "", maxAge: 300),
            storage: storage
        )
        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "new", tags: "", maxAge: 300),
            storage: storage
        )

        let result = try await handler.get(
            input: CacheGetInput(key: "k1"),
            storage: storage
        )

        if case .ok(_, let value) = result {
            XCTAssertEqual(value, "new")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - invalidate

    func testCacheInvalidate() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "v1", tags: "", maxAge: 300),
            storage: storage
        )

        let result = try await handler.invalidate(
            input: CacheInvalidateInput(key: "k1"),
            storage: storage
        )

        if case .ok(let key) = result {
            XCTAssertEqual(key, "k1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        // Verify cache miss after invalidation
        let getResult = try await handler.get(
            input: CacheGetInput(key: "k1"),
            storage: storage
        )
        if case .miss = getResult {
            // expected
        } else {
            XCTFail("Expected .miss after invalidation")
        }
    }

    func testCacheInvalidateNonexistentKey() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        let result = try await handler.invalidate(
            input: CacheInvalidateInput(key: "does-not-exist"),
            storage: storage
        )

        if case .ok(let key) = result {
            XCTAssertEqual(key, "does-not-exist")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - invalidateByTags

    func testCacheInvalidateByTags() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "v1", tags: "page,node", maxAge: 300),
            storage: storage
        )
        _ = try await handler.set(
            input: CacheSetInput(key: "k2", value: "v2", tags: "user", maxAge: 300),
            storage: storage
        )
        _ = try await handler.set(
            input: CacheSetInput(key: "k3", value: "v3", tags: "page", maxAge: 300),
            storage: storage
        )

        let result = try await handler.invalidateByTags(
            input: CacheInvalidateByTagsInput(tags: "page"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        // k2 should still be present
        let k2Result = try await handler.get(input: CacheGetInput(key: "k2"), storage: storage)
        if case .ok = k2Result { /* expected */ }
        else { XCTFail("Expected k2 to still be cached") }
    }

    func testCacheInvalidateByTagsNoMatches() async throws {
        let storage = InMemoryStorage()
        let handler = CacheHandlerImpl()

        _ = try await handler.set(
            input: CacheSetInput(key: "k1", value: "v1", tags: "alpha", maxAge: 300),
            storage: storage
        )

        let result = try await handler.invalidateByTags(
            input: CacheInvalidateByTagsInput(tags: "beta"),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
