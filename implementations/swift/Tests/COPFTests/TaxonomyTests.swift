// TaxonomyTests.swift — Tests for Taxonomy concept

import XCTest
@testable import COPF

final class TaxonomyTests: XCTestCase {

    // MARK: - createVocabulary

    func testCreateVocabularyReturnsOkWithVocabId() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let result = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(name: "Topics"),
            storage: storage
        )

        if case .ok(let vocabId) = result {
            XCTAssertFalse(vocabId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateVocabularyStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let result = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(name: "Categories"),
            storage: storage
        )

        if case .ok(let vocabId) = result {
            let record = try await storage.get(relation: "vocabulary", key: vocabId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "Categories")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMultipleVocabularies() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let r1 = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(name: "Topics"),
            storage: storage
        )
        let r2 = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(name: "Tags"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertNotEqual(id1, id2)
        } else {
            XCTFail("Expected .ok for both")
        }
    }

    // MARK: - addTerm

    func testAddTermReturnsOkWithTermId() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let vocabResult = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(name: "Topics"),
            storage: storage
        )

        guard case .ok(let vocabId) = vocabResult else {
            return XCTFail("Expected vocabulary creation to succeed")
        }

        let result = try await handler.addTerm(
            input: TaxonomyAddTermInput(vocabId: vocabId, name: "Science", parentTermId: ""),
            storage: storage
        )

        if case .ok(let termId) = result {
            XCTAssertFalse(termId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddTermToMissingVocabReturnsVocabNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let result = try await handler.addTerm(
            input: TaxonomyAddTermInput(vocabId: "missing", name: "Term", parentTermId: ""),
            storage: storage
        )

        if case .vocabNotfound = result {
            // expected
        } else {
            XCTFail("Expected .vocabNotfound but got \(result)")
        }
    }

    // MARK: - setParent

    func testSetParentReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let vocabResult = try await handler.createVocabulary(
            input: TaxonomyCreateVocabularyInput(name: "Topics"),
            storage: storage
        )
        guard case .ok(let vocabId) = vocabResult else {
            return XCTFail("Expected vocabulary creation to succeed")
        }

        let termResult = try await handler.addTerm(
            input: TaxonomyAddTermInput(vocabId: vocabId, name: "Physics", parentTermId: ""),
            storage: storage
        )
        guard case .ok(let termId) = termResult else {
            return XCTFail("Expected term creation to succeed")
        }

        let parentResult = try await handler.addTerm(
            input: TaxonomyAddTermInput(vocabId: vocabId, name: "Science", parentTermId: ""),
            storage: storage
        )
        guard case .ok(let parentId) = parentResult else {
            return XCTFail("Expected parent term creation to succeed")
        }

        let result = try await handler.setParent(
            input: TaxonomySetParentInput(termId: termId, parentTermId: parentId),
            storage: storage
        )

        if case .ok(let tId) = result {
            XCTAssertEqual(tId, termId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetParentMissingTermReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let result = try await handler.setParent(
            input: TaxonomySetParentInput(termId: "missing", parentTermId: "parent1"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - tagEntity

    func testTagEntityReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let result = try await handler.tagEntity(
            input: TaxonomyTagEntityInput(nodeId: "node1", termId: "term1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "node1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testTagEntityStoresMapping() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        _ = try await handler.tagEntity(
            input: TaxonomyTagEntityInput(nodeId: "n1", termId: "t1"),
            storage: storage
        )

        let record = try await storage.get(relation: "term_index", key: "n1:t1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["nodeId"] as? String, "n1")
    }

    // MARK: - untagEntity

    func testUntagEntityReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        _ = try await handler.tagEntity(
            input: TaxonomyTagEntityInput(nodeId: "n1", termId: "t1"),
            storage: storage
        )

        let result = try await handler.untagEntity(
            input: TaxonomyUntagEntityInput(nodeId: "n1", termId: "t1"),
            storage: storage
        )

        if case .ok(let nodeId) = result {
            XCTAssertEqual(nodeId, "n1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUntagEntityMissingReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = TaxonomyHandlerImpl()

        let result = try await handler.untagEntity(
            input: TaxonomyUntagEntityInput(nodeId: "n1", termId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
