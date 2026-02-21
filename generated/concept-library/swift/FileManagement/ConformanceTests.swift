// generated: FileManagement/ConformanceTests.swift

import XCTest
@testable import COPF

final class FileManagementConformanceTests: XCTestCase {

    func testFileManagementInvariant1() async throws {
        // invariant 1: after upload, addUsage, removeUsage, garbageCollect behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"
        let d = "u-test-invariant-002"
        let m = "u-test-invariant-003"
        let e = "u-test-invariant-004"

        // --- AFTER clause ---
        // upload(file: f, data: d, mimeType: m) -> ok(file: f)
        let step1 = try await handler.upload(
            input: FileManagementUploadInput(file: f, data: d, mimeType: m),
            storage: storage
        )
        if case .ok(let file) = step1 {
            XCTAssertEqual(file, f)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // addUsage(file: f, entity: e) -> ok()
        let step2 = try await handler.addUsage(
            input: FileManagementAddUsageInput(file: f, entity: e),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // removeUsage(file: f, entity: e) -> ok()
        let step3 = try await handler.removeUsage(
            input: FileManagementRemoveUsageInput(file: f, entity: e),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
        // garbageCollect() -> ok(removed: 1)
        let step4 = try await handler.garbageCollect(
            input: FileManagementGarbageCollectInput(),
            storage: storage
        )
        if case .ok(let removed) = step4 {
            XCTAssertEqual(removed, 1)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

}
