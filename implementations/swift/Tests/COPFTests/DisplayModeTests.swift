// DisplayModeTests.swift — Tests for DisplayMode concept

import XCTest
@testable import COPF

final class DisplayModeTests: XCTestCase {

    // MARK: - defineMode

    func testDefineMode() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let result = try await handler.defineMode(
            input: DisplayModeDefineModeInput(name: "Full View", modeType: "full"),
            storage: storage
        )

        if case .ok(let modeId) = result {
            XCTAssertFalse(modeId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineModeStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let result = try await handler.defineMode(
            input: DisplayModeDefineModeInput(name: "Teaser", modeType: "teaser"),
            storage: storage
        )

        if case .ok(let modeId) = result {
            let record = try await storage.get(relation: "display_mode", key: modeId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "Teaser")
            XCTAssertEqual(record?["modeType"] as? String, "teaser")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineMultipleModes() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let result1 = try await handler.defineMode(
            input: DisplayModeDefineModeInput(name: "Full", modeType: "full"),
            storage: storage
        )
        let result2 = try await handler.defineMode(
            input: DisplayModeDefineModeInput(name: "Compact", modeType: "compact"),
            storage: storage
        )

        guard case .ok(let id1) = result1, case .ok(let id2) = result2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - configureFieldDisplay

    func testConfigureFieldDisplay() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let result = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(
                schemaId: "s1", modeId: "m1", fieldId: "title",
                formatter: "plain_text", settings: "{}"
            ),
            storage: storage
        )

        if case .ok(let modeId) = result {
            XCTAssertEqual(modeId, "m1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testConfigureFieldDisplayStoresConfig() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        _ = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(
                schemaId: "s1", modeId: "m1", fieldId: "title",
                formatter: "plain_text", settings: "{\"trim\": true}"
            ),
            storage: storage
        )

        let record = try await storage.get(relation: "field_display_config", key: "s1:m1:title")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["formatter"] as? String, "plain_text")
        XCTAssertEqual(record?["fieldId"] as? String, "title")
    }

    func testConfigureMultipleFieldDisplays() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        _ = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(
                schemaId: "s1", modeId: "m1", fieldId: "title",
                formatter: "plain_text", settings: "{}"
            ),
            storage: storage
        )
        _ = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(
                schemaId: "s1", modeId: "m1", fieldId: "body",
                formatter: "rich_text", settings: "{}"
            ),
            storage: storage
        )

        let titleConfig = try await storage.get(relation: "field_display_config", key: "s1:m1:title")
        let bodyConfig = try await storage.get(relation: "field_display_config", key: "s1:m1:body")
        XCTAssertNotNil(titleConfig)
        XCTAssertNotNil(bodyConfig)
    }

    // MARK: - renderInMode

    func testRenderInMode() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let modeResult = try await handler.defineMode(
            input: DisplayModeDefineModeInput(name: "Full", modeType: "full"),
            storage: storage
        )
        guard case .ok(let modeId) = modeResult else {
            return XCTFail("Expected .ok on defineMode")
        }

        let result = try await handler.renderInMode(
            input: DisplayModeRenderInModeInput(nodeId: "n1", modeId: modeId),
            storage: storage
        )

        if case .ok(let nodeId, let rendered) = result {
            XCTAssertEqual(nodeId, "n1")
            XCTAssertTrue(rendered.contains("n1"))
            XCTAssertTrue(rendered.contains(modeId))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRenderInModeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let result = try await handler.renderInMode(
            input: DisplayModeRenderInModeInput(nodeId: "n1", modeId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testRenderInModeIncludesFieldConfigs() async throws {
        let storage = InMemoryStorage()
        let handler = DisplayModeHandlerImpl()

        let modeResult = try await handler.defineMode(
            input: DisplayModeDefineModeInput(name: "Full", modeType: "full"),
            storage: storage
        )
        guard case .ok(let modeId) = modeResult else {
            return XCTFail("Expected .ok on defineMode")
        }

        _ = try await handler.configureFieldDisplay(
            input: DisplayModeConfigureFieldDisplayInput(
                schemaId: "s1", modeId: modeId, fieldId: "title",
                formatter: "plain_text", settings: "{}"
            ),
            storage: storage
        )

        let result = try await handler.renderInMode(
            input: DisplayModeRenderInModeInput(nodeId: "n1", modeId: modeId),
            storage: storage
        )

        if case .ok(_, let rendered) = result {
            XCTAssertTrue(rendered.contains("title"))
            XCTAssertTrue(rendered.contains("plain_text"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
