// generated: Taxonomy/ConformanceTests.swift

import XCTest
@testable import COPF

final class TaxonomyConformanceTests: XCTestCase {

    func testTaxonomyInvariant1() async throws {
        // invariant 1: after createVocabulary, addTerm, tagEntity, untagEntity behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let v = "u-test-invariant-001"
        let none = "u-test-invariant-002"

        // --- AFTER clause ---
        // createVocabulary(vocab: v, name: "topics") -> ok()
        let step1 = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(vocab: v, name: "topics"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // addTerm(vocab: v, term: "science", parent: none) -> ok()
        let step2 = try await handler.addTerm(
            input: TaxonomyAddTermInput(vocab: v, term: "science", parent: none),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // tagEntity(entity: "page-1", vocab: v, term: "science") -> ok()
        let step3 = try await handler.tagEntity(
            input: TaxonomyTagEntityInput(entity: "page-1", vocab: v, term: "science"),
            storage: storage
        )
        guard case .ok = step3 else {
            XCTFail("Expected .ok, got \(step3)")
            return
        }
        // untagEntity(entity: "page-1", vocab: v, term: "science") -> ok()
        let step4 = try await handler.untagEntity(
            input: TaxonomyUntagEntityInput(entity: "page-1", vocab: v, term: "science"),
            storage: storage
        )
        guard case .ok = step4 else {
            XCTFail("Expected .ok, got \(step4)")
            return
        }
    }

}
