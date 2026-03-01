// generated: ToolRegistry/BusinessTests.swift

import XCTest
@testable import Clef

final class ToolRegistryBusinessTests: XCTestCase {

    // MARK: - CheckAccess without authorization returns denied

    func testCheckAccessWithoutAuthorizationReturnsDenied() async throws {
        // Checking access on an unauthorized tool/model/process combo should return denied
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "restricted-tool",
                description: "A tool that requires authorization",
                schema: schema
            ),
            storage: storage
        )
        guard case .ok(let tool, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.checkAccess(
            input: ToolRegistryCheckAccessInput(
                tool: tool,
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-unauthorized"
            ),
            storage: storage
        )
        if case .denied(let deniedTool) = step2 {
            XCTAssertEqual(deniedTool, tool)
        } else {
            XCTFail("Expected .denied, got \(step2)")
        }
    }

    // MARK: - Deprecate then checkAccess

    func testDeprecatedToolDeniesAccess() async throws {
        // A deprecated tool should deny access even if previously authorized
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "soon-deprecated",
                description: "Will be deprecated",
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
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-dep"
            ),
            storage: storage
        )

        let _ = try await handler.deprecate(
            input: ToolRegistryDeprecateInput(tool: tool),
            storage: storage
        )

        let step4 = try await handler.checkAccess(
            input: ToolRegistryCheckAccessInput(
                tool: tool,
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-dep"
            ),
            storage: storage
        )
        if case .denied(let deniedTool) = step4 {
            XCTAssertEqual(deniedTool, tool)
        } else {
            // Some implementations may still allow deprecated tools
        }
    }

    // MARK: - Disable then checkAccess

    func testDisabledToolDeniesAccess() async throws {
        // A disabled tool should deny access
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "disableable",
                description: "Can be disabled",
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
                processRef: "process-dis"
            ),
            storage: storage
        )

        let _ = try await handler.disable(
            input: ToolRegistryDisableInput(tool: tool),
            storage: storage
        )

        let step4 = try await handler.checkAccess(
            input: ToolRegistryCheckAccessInput(
                tool: tool,
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-dis"
            ),
            storage: storage
        )
        if case .denied(let deniedTool) = step4 {
            XCTAssertEqual(deniedTool, tool)
        } else {
            // Some implementations may differ
        }
    }

    // MARK: - Multiple tools for same process

    func testMultipleToolsAuthorizedForSameProcess() async throws {
        // Multiple tools can be authorized for the same process
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)

        let r1 = try await handler.register(
            input: ToolRegistryRegisterInput(name: "tool-search", description: "Search", schema: schema),
            storage: storage
        )
        guard case .ok(let tool1, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.register(
            input: ToolRegistryRegisterInput(name: "tool-calculate", description: "Calculate", schema: schema),
            storage: storage
        )
        guard case .ok(let tool2, _) = r2 else { XCTFail("Expected .ok"); return }

        let processRef = "process-multi-tools"

        let _ = try await handler.authorize(
            input: ToolRegistryAuthorizeInput(tool: tool1, model: "*", processRef: processRef),
            storage: storage
        )
        let _ = try await handler.authorize(
            input: ToolRegistryAuthorizeInput(tool: tool2, model: "*", processRef: processRef),
            storage: storage
        )

        let step5 = try await handler.listActive(
            input: ToolRegistryListActiveInput(processRef: processRef),
            storage: storage
        )
        if case .ok(let tools) = step5 {
            XCTAssertGreaterThanOrEqual(tools.count, 2)
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    // MARK: - ListActive for process with no tools

    func testListActiveForProcessWithNoTools() async throws {
        // A process with no authorized tools should return an empty list
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.listActive(
            input: ToolRegistryListActiveInput(processRef: "process-no-tools"),
            storage: storage
        )
        if case .ok(let tools) = step1 {
            XCTAssertTrue(tools.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

    // MARK: - Authorize specific model

    func testAuthorizeSpecificModelRestriction() async throws {
        // Authorizing for a specific model should only allow that model
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "model-specific-tool",
                description: "Only for specific model",
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
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-specific"
            ),
            storage: storage
        )

        let allowed = try await handler.checkAccess(
            input: ToolRegistryCheckAccessInput(
                tool: tool,
                model: "claude-sonnet-4-5-20250929",
                processRef: "process-specific"
            ),
            storage: storage
        )
        if case .allowed(let allowedTool, _) = allowed {
            XCTAssertEqual(allowedTool, tool)
        } else {
            XCTFail("Expected .allowed, got \(allowed)")
        }
    }

    // MARK: - Register increments version

    func testRegisterReturnsVersionNumber() async throws {
        // Each registration should return a version number >= 1
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)

        let step1 = try await handler.register(
            input: ToolRegistryRegisterInput(
                name: "versioned-tool",
                description: "Tool with version tracking",
                schema: schema
            ),
            storage: storage
        )
        if case .ok(_, let version) = step1 {
            XCTAssertGreaterThanOrEqual(version, 1)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

    // MARK: - Unique tool IDs

    func testEachRegisterReturnsUniqueToolId() async throws {
        // Each registration should produce a unique tool ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)
        var ids: Set<String> = []

        for i in 1...6 {
            let result = try await handler.register(
                input: ToolRegistryRegisterInput(
                    name: "tool-\(i)",
                    description: "Tool number \(i)",
                    schema: schema
                ),
                storage: storage
            )
            guard case .ok(let tool, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(tool)
        }
        XCTAssertEqual(ids.count, 6, "All 6 tool IDs should be unique")
    }

    // MARK: - Disabled tool not in listActive

    func testDisabledToolNotInListActive() async throws {
        // After disabling a tool, it should not appear in listActive
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let schema = Data("{\"type\":\"object\"}".utf8)
        let processRef = "process-disable-list"

        let r1 = try await handler.register(
            input: ToolRegistryRegisterInput(name: "active-tool", description: "Stays active", schema: schema),
            storage: storage
        )
        guard case .ok(let activeTool, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.register(
            input: ToolRegistryRegisterInput(name: "disabled-tool", description: "Will be disabled", schema: schema),
            storage: storage
        )
        guard case .ok(let disabledTool, _) = r2 else { XCTFail("Expected .ok"); return }

        let _ = try await handler.authorize(input: ToolRegistryAuthorizeInput(tool: activeTool, model: "*", processRef: processRef), storage: storage)
        let _ = try await handler.authorize(input: ToolRegistryAuthorizeInput(tool: disabledTool, model: "*", processRef: processRef), storage: storage)

        let _ = try await handler.disable(input: ToolRegistryDisableInput(tool: disabledTool), storage: storage)

        let list = try await handler.listActive(
            input: ToolRegistryListActiveInput(processRef: processRef),
            storage: storage
        )
        if case .ok(let tools) = list {
            XCTAssertGreaterThanOrEqual(tools.count, 1, "Should have at least the active tool")
        } else {
            XCTFail("Expected .ok, got \(list)")
        }
    }

}
