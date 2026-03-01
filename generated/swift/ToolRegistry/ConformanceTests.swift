// generated: ToolRegistry/ConformanceTests.swift

import XCTest
@testable import Clef

final class ToolRegistryConformanceTests: XCTestCase {

    func testToolRegistryRegisterAndCheckAccess() async throws {
        // invariant: after register and authorize, checkAccess returns allowed with schema
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let schema = Data("{\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\"}}}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "web-search",
                description: "Search the web for information",
                schema: schema
            ),
            storage: storage
        )
        guard case .ok(let tool, let version) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(tool.isEmpty)
        XCTAssertGreaterThanOrEqual(version, 1)

        let step2 = try await handler.authorize(
            input: ToolRegistryAuthorizeInput(
                tool: tool,
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-email"
            ),
            storage: storage
        )
        if case .ok(let authorizedTool) = step2 {
            XCTAssertEqual(authorizedTool, tool)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.checkAccess(
            input: ToolRegistryCheckAccessInput(
                tool: tool,
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-email"
            ),
            storage: storage
        )
        if case .allowed(let allowedTool, _) = step3 {
            XCTAssertEqual(allowedTool, tool)
        } else {
            XCTFail("Expected .allowed, got \(step3)")
        }
    }

    func testToolRegistryDeprecate() async throws {
        // invariant: after deprecate, the tool transitions to deprecated status
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "old-calculator",
                description: "Legacy calculator tool",
                schema: schema
            ),
            storage: storage
        )
        guard case .ok(let tool, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.deprecate(
            input: ToolRegistryDeprecateInput(tool: tool),
            storage: storage
        )
        if case .ok(let deprecatedTool) = step2 {
            XCTAssertEqual(deprecatedTool, tool)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testToolRegistryDisable() async throws {
        // invariant: after disable, the tool transitions to disabled status
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "risky-tool",
                description: "A tool that needs to be disabled",
                schema: schema
            ),
            storage: storage
        )
        guard case .ok(let tool, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.disable(
            input: ToolRegistryDisableInput(tool: tool),
            storage: storage
        )
        if case .ok(let disabledTool) = step2 {
            XCTAssertEqual(disabledTool, tool)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testToolRegistryListActive() async throws {
        // invariant: after register, listActive includes the tool for the authorized process
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let schema = Data("{\"type\":\"object\",\"properties\":{\"code\":{\"type\":\"string\"}}}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "code-exec",
                description: "Execute code snippets",
                schema: schema
            ),
            storage: storage
        )
        guard case .ok(let tool, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.authorize(
            input: ToolRegistryAuthorizeInput(
                tool: tool,
                model: "*",
                processRef: "process-coding"
            ),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.listActive(
            input: ToolRegistryListActiveInput(processRef: "process-coding"),
            storage: storage
        )
        if case .ok(let tools) = step3 {
            XCTAssertFalse(tools.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
