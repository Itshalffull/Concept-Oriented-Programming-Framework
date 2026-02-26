// generated: ContentStorage/ConformanceTests.swift

import XCTest
@testable import COPF

final class ContentStorageConformanceTests: XCTestCase {

    func testContentStorageInvariant1() async throws {
        // invariant 1: after save, load behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"

        // --- AFTER clause ---
        // save(record: r, data: "{"title":"Test"}") -> ok(record: r)
        let step1 = try await handler.save(
            input: ContentStorageSaveInput(record: r, data: "{"title":"Test"}"),
            storage: storage
        )
        if case .ok(let record) = step1 {
            XCTAssertEqual(record, r)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // load(record: r) -> ok(record: r, data: "{"title":"Test"}")
        let step2 = try await handler.load(
            input: ContentStorageLoadInput(record: r),
            storage: storage
        )
        if case .ok(let record, let data) = step2 {
            XCTAssertEqual(record, r)
            XCTAssertEqual(data, "{"title":"Test"}")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testContentStorageInvariant2() async throws {
        // invariant 2: after save, delete, load behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"

        // --- AFTER clause ---
        // save(record: r, data: "{"title":"Test"}") -> ok(record: r)
        let step1 = try await handler.save(
            input: ContentStorageSaveInput(record: r, data: "{"title":"Test"}"),
            storage: storage
        )
        if case .ok(let record) = step1 {
            XCTAssertEqual(record, r)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // delete(record: r) -> ok(record: r)
        let step2 = try await handler.delete(
            input: ContentStorageDeleteInput(record: r),
            storage: storage
        )
        if case .ok(let record) = step2 {
            XCTAssertEqual(record, r)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // load(record: r) -> notfound(message: "not found")
        let step3 = try await handler.load(
            input: ContentStorageLoadInput(record: r),
            storage: storage
        )
        if case .notfound(let message) = step3 {
            XCTAssertEqual(message, "not found")
        } else {
            XCTFail("Expected .notfound, got \(step3)")
        }
    }

}
