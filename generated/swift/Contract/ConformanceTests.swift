// generated: Contract/ConformanceTests.swift

import XCTest
@testable import Clef

final class ContractConformanceTests: XCTestCase {

    func testContractInvariant1() async throws {
        // invariant 1: after define, verify behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"

        // --- AFTER clause ---
        // define(name: "user-password-contract", source_concept: "clef/concept/User", target_concept: "clef/concept/Password", assumptions: ["user-exists-before-password"], guarantees: ["password-hash-nonzero"]) -> ok(contract: c)
        let step1 = try await handler.define(
            input: ContractDefineInput(name: "user-password-contract", source_concept: "clef/concept/User", target_concept: "clef/concept/Password", assumptions: ["user-exists-before-password"], guarantees: ["password-hash-nonzero"]),
            storage: storage
        )
        if case .ok(let contract) = step1 {
            XCTAssertEqual(contract, c)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // verify(contract: c) -> ok(contract: c, compatible: true)
        let step2 = try await handler.verify(
            input: ContractVerifyInput(contract: c),
            storage: storage
        )
        if case .ok(let contract, let compatible) = step2 {
            XCTAssertEqual(contract, c)
            XCTAssertEqual(compatible, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}