// generated: Cache/ConformanceTests.swift

import XCTest
@testable import Clef

final class CacheConformanceTests: XCTestCase {

    func testCacheInvariant1() async throws {
        // invariant 1: after set, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let b = "u-test-invariant-001"

        // --- AFTER clause ---
        // set(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300) -> ok()
        let step1 = try await handler.set(
            input: CacheSetInput(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // get(bin: b, key: "k") -> ok(data: "v")
        let step2 = try await handler.get(
            input: CacheGetInput(bin: b, key: "k"),
            storage: storage
        )
        if case .ok(let data) = step2 {
            XCTAssertEqual(data, "v")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testCacheInvariant2() async throws {
        // invariant 2: after set, invalidateByTags, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let b = "u-test-invariant-001"

        // --- AFTER clause ---
        // set(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300) -> ok()
        let step1 = try await handler.set(
            input: CacheSetInput(bin: b, key: "k", data: "v", tags: "t1", maxAge: 300),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // invalidateByTags(tags: "t1") -> ok(count: 1)
        let step2 = try await handler.invalidateByTags(
            input: CacheInvalidateByTagsInput(tags: "t1"),
            storage: storage
        )
        if case .ok(let count) = step2 {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // get(bin: b, key: "k") -> miss()
        let step3 = try await handler.get(
            input: CacheGetInput(bin: b, key: "k"),
            storage: storage
        )
        guard case .miss = step3 else {
            XCTFail("Expected .miss, got \(step3)")
            return
        }
    }

}
