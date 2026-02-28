// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title McpTarget
/// @notice Interface-target provider that generates MCP (Model Context Protocol) tool definitions.
/// @dev Produces JSON tool schemas and TypeScript server stubs.

contract McpTarget {

    // --- Storage ---

    /// @dev Maps tool hash to whether it exists
    mapping(bytes32 => bool) private tools;
    bytes32[] private toolsKeys;

    /// @dev Maps tool hash to its name
    mapping(bytes32 => string) private toolNames;

    /// @dev Maps concept hash to generated tool names
    mapping(bytes32 => string[]) private conceptTools;

    /// @dev Maps concept hash to generated resource names
    mapping(bytes32 => string[]) private conceptResources;

    /// @dev Maps concept hash to generated template names
    mapping(bytes32 => string[]) private conceptTemplates;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        string[] tools;
        string[] files;
    }

    struct GenerateTooManyToolsResult {
        bool success;
        int256 count;
        int256 limit;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 tool;
    }

    struct ValidateMissingDescriptionResult {
        bool success;
        bytes32 tool;
        string toolName;
    }

    struct ListToolsOkResult {
        bool success;
        string[] tools;
        string[] resources;
        string[] templates;
    }

    // --- Events ---

    event GenerateCompleted(string variant, string[] tools, string[] files, int256 count, int256 limit);
    event ValidateCompleted(string variant, bytes32 tool);
    event ListToolsCompleted(string variant, string[] tools, string[] resources, string[] templates);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "mcp";
        category = "interface-target";
        formats = new string[](2);
        formats[0] = "json";
        formats[1] = "typescript";
    }

    // --- Actions ---

    /// @notice Generate MCP tool definitions from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 toolHash = keccak256(abi.encodePacked(projection, generationCount));
        generationCount++;

        string memory toolName = string(abi.encodePacked(projection, "_tool"));

        if (!tools[toolHash]) {
            tools[toolHash] = true;
            toolsKeys.push(toolHash);
        }
        toolNames[toolHash] = toolName;

        // Build output
        string[] memory toolList = new string[](1);
        toolList[0] = toolName;

        string[] memory files = new string[](2);
        files[0] = string(abi.encodePacked(projection, ".mcp.json"));
        files[1] = string(abi.encodePacked(projection, ".mcp.ts"));

        // Store concept-level listings
        bytes32 conceptHash = keccak256(abi.encodePacked(projection));
        conceptTools[conceptHash] = toolList;

        string[] memory resources = new string[](1);
        resources[0] = string(abi.encodePacked(projection, "://resource"));
        conceptResources[conceptHash] = resources;

        string[] memory templates = new string[](1);
        templates[0] = string(abi.encodePacked(projection, "://{id}"));
        conceptTemplates[conceptHash] = templates;

        emit GenerateCompleted("ok", toolList, files, 1, 128);

        return GenerateOkResult({
            success: true,
            tools: toolList,
            files: files
        });
    }

    /// @notice Validate a generated MCP tool definition
    function validate(bytes32 tool) external returns (ValidateOkResult memory) {
        require(tools[tool], "Tool not found");

        emit ValidateCompleted("ok", tool);

        return ValidateOkResult({
            success: true,
            tool: tool
        });
    }

    /// @notice List all generated tools, resources, and templates for a concept
    function listTools(string memory concept) external returns (ListToolsOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        string[] memory toolList = conceptTools[conceptHash];
        string[] memory resources = conceptResources[conceptHash];
        string[] memory templates = conceptTemplates[conceptHash];

        if (toolList.length == 0) {
            toolList = new string[](0);
            resources = new string[](0);
            templates = new string[](0);
        }

        emit ListToolsCompleted("ok", toolList, resources, templates);

        return ListToolsOkResult({
            success: true,
            tools: toolList,
            resources: resources,
            templates: templates
        });
    }

}
