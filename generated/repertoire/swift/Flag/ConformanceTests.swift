// generated: Flag/ConformanceTests.swift

import XCTest
@testable import Clef

final class FlagConformanceTests: XCTestCase {

    func testFlagInvariant1() async throws {
        // invariant 1: after flag, isFlagged behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"
        let t = "u-test-invariant-002"
        let e = "u-test-invariant-003"
        let u = "u-test-invariant-004"

        // --- AFTER clause ---
        // flag(flagging: f, flagType: t, entity: e, user: u) -> ok()
        let step1 = try await handler.flag(
            input: FlagFlagInput(flagging: f, flagType: t, entity: e, user: u),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // isFlagged(flagType: t, entity: e, user: u) -> ok(flagged: true)
        let step2 = try await handler.isFlagged(
            input: FlagIsFlaggedInput(flagType: t, entity: e, user: u),
            storage: storage
        )
        if case .ok(let flagged) = step2 {
            XCTAssertEqual(flagged, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testFlagInvariant2() async throws {
        // invariant 2: after flag, unflag, isFlagged behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"
        let t = "u-test-invariant-002"
        let e = "u-test-invariant-003"
        let u = "u-test-invariant-004"

        // --- AFTER clause ---
        // flag(flagging: f, flagType: t, entity: e, user: u) -> ok()
        let step1 = try await handler.flag(
            input: FlagFlagInput(flagging: f, flagType: t, entity: e, user: u),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // unflag(flagging: f) -> ok()
        let step2 = try await handler.unflag(
            input: FlagUnflagInput(flagging: f),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // isFlagged(flagType: t, entity: e, user: u) -> ok(flagged: false)
        let step3 = try await handler.isFlagged(
            input: FlagIsFlaggedInput(flagType: t, entity: e, user: u),
            storage: storage
        )
        if case .ok(let flagged) = step3 {
            XCTAssertEqual(flagged, false)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
