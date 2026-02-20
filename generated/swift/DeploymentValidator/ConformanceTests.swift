// generated: DeploymentValidator/ConformanceTests.swift

import XCTest
@testable import COPF

final class DeploymentValidatorConformanceTests: XCTestCase {

    func testDeploymentValidatorInvariant1() async throws {
        // invariant 1: after parse, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let m = "u-test-invariant-001"
        let i = "u-test-invariant-002"

        // --- AFTER clause ---
        // parse(raw: "{"app":{"name":"myapp","version":"1.0","uri":"urn:app/myapp"},"runtimes":{},"concepts":{},"syncs":[]}") -> ok(manifest: m)
        let step1 = try await handler.parse(
            input: DeploymentValidatorParseInput(raw: "{"app":{"name":"myapp","version":"1.0","uri":"urn:app/myapp"},"runtimes":{},"concepts":{},"syncs":[]}"),
            storage: storage
        )
        if case .ok(let manifest) = step1 {
            XCTAssertEqual(manifest, m)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // validate(manifest: m) -> error(issues: i)
        let step2 = try await handler.validate(
            input: DeploymentValidatorValidateInput(manifest: m),
            storage: storage
        )
        if case .error(let issues) = step2 {
            XCTAssertEqual(issues, i)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

    func testDeploymentValidatorInvariant2() async throws {
        // invariant 2: after parse, parse behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let m = "u-test-invariant-001"
        let e = "u-test-invariant-002"

        // --- AFTER clause ---
        // parse(raw: "{"app":{"name":"t","version":"1","uri":"u"},"runtimes":{},"concepts":{},"syncs":[]}") -> ok(manifest: m)
        let step1 = try await handler.parse(
            input: DeploymentValidatorParseInput(raw: "{"app":{"name":"t","version":"1","uri":"u"},"runtimes":{},"concepts":{},"syncs":[]}"),
            storage: storage
        )
        if case .ok(let manifest) = step1 {
            XCTAssertEqual(manifest, m)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // parse(raw: "not json") -> error(message: e)
        let step2 = try await handler.parse(
            input: DeploymentValidatorParseInput(raw: "not json"),
            storage: storage
        )
        if case .error(let message) = step2 {
            XCTAssertEqual(message, e)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
