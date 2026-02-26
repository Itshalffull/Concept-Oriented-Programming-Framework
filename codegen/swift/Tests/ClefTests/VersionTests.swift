// VersionTests.swift — Tests for Version concept

import XCTest
@testable import Clef

final class VersionTests: XCTestCase {

    // MARK: - snapshot

    func testSnapshot() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let result = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "{\"title\":\"Hello\"}"),
            storage: storage
        )

        if case .ok(let entityId, let versionId) = result {
            XCTAssertEqual(entityId, "e1")
            XCTAssertFalse(versionId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSnapshotStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let result = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "{\"v\":1}"),
            storage: storage
        )

        if case .ok(let entityId, let versionId) = result {
            let key = "\(entityId):\(versionId)"
            let record = try await storage.get(relation: "version_history", key: key)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["snapshotData"] as? String, "{\"v\":1}")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSnapshotMultipleVersions() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let r1 = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "v1"),
            storage: storage
        )
        let r2 = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "v2"),
            storage: storage
        )

        guard case .ok(_, let vid1) = r1, case .ok(_, let vid2) = r2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(vid1, vid2)
    }

    // MARK: - listVersions

    func testListVersions() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        _ = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "v1"),
            storage: storage
        )
        _ = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "v2"),
            storage: storage
        )

        let result = try await handler.listVersions(
            input: VersionListVersionsInput(entityId: "e1"),
            storage: storage
        )

        if case .ok(let entityId, let versions) = result {
            XCTAssertEqual(entityId, "e1")
            let data = versions.data(using: .utf8)!
            let array = try JSONSerialization.jsonObject(with: data) as! [[String: Any]]
            XCTAssertEqual(array.count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListVersionsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let result = try await handler.listVersions(
            input: VersionListVersionsInput(entityId: "e1"),
            storage: storage
        )

        if case .ok(_, let versions) = result {
            XCTAssertEqual(versions, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - rollback

    func testRollback() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let snapshotResult = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "original"),
            storage: storage
        )
        guard case .ok(let entityId, let versionId) = snapshotResult else {
            return XCTFail("Expected .ok on snapshot")
        }

        let result = try await handler.rollback(
            input: VersionRollbackInput(entityId: entityId, versionId: versionId),
            storage: storage
        )

        if case .ok(let returnedEntityId) = result {
            XCTAssertEqual(returnedEntityId, "e1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRollbackVersionNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let result = try await handler.rollback(
            input: VersionRollbackInput(entityId: "e1", versionId: "nonexistent"),
            storage: storage
        )

        if case .versionNotfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .versionNotfound but got \(result)")
        }
    }

    // MARK: - diff

    func testDiff() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let r1 = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "version_a_data"),
            storage: storage
        )
        let r2 = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "version_b_data"),
            storage: storage
        )

        guard case .ok(_, let vidA) = r1, case .ok(_, let vidB) = r2 else {
            return XCTFail("Expected both snapshots to be .ok")
        }

        let result = try await handler.diff(
            input: VersionDiffInput(entityId: "e1", versionA: vidA, versionB: vidB),
            storage: storage
        )

        if case .ok(let entityId, let changes) = result {
            XCTAssertEqual(entityId, "e1")
            XCTAssertTrue(changes.contains("true"))  // changed = true
            XCTAssertTrue(changes.contains("version_a_data"))
            XCTAssertTrue(changes.contains("version_b_data"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDiffVersionNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let result = try await handler.diff(
            input: VersionDiffInput(entityId: "e1", versionA: "missing_a", versionB: "missing_b"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing_a"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testDiffSameVersionNotChanged() async throws {
        let storage = InMemoryStorage()
        let handler = VersionHandlerImpl()

        let r1 = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "same_data"),
            storage: storage
        )
        let r2 = try await handler.snapshot(
            input: VersionSnapshotInput(entityId: "e1", snapshotData: "same_data"),
            storage: storage
        )

        guard case .ok(_, let vidA) = r1, case .ok(_, let vidB) = r2 else {
            return XCTFail("Expected both snapshots to be .ok")
        }

        let result = try await handler.diff(
            input: VersionDiffInput(entityId: "e1", versionA: vidA, versionB: vidB),
            storage: storage
        )

        if case .ok(_, let changes) = result {
            XCTAssertTrue(changes.contains("false"))  // changed = false
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
