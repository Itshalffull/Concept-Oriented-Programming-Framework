// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Toolchain
/// @notice Base toolchain concept for resolving, validating, and listing development tools.
contract Toolchain {

    // --- Storage ---

    /// @dev Tool record keyed by tool ID
    struct ToolRecord {
        string language;
        string platform;
        string version;
        string path;
        string category;
        string[] capabilities;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => ToolRecord) private _tools;
    bytes32[] private _toolIds;

    // --- Types ---

    struct ResolveInput {
        string language;
        string platform;
        string versionConstraint;
        string category;
        string toolName;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 tool;
        string version;
        string path;
        string[] capabilities;
        bytes invocation;
    }

    struct ResolveNotInstalledResult {
        bool success;
        string language;
        string platform;
        string installHint;
    }

    struct ResolveVersionMismatchResult {
        bool success;
        string language;
        string installed;
        string required;
    }

    struct ResolvePlatformUnsupportedResult {
        bool success;
        string language;
        string platform;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 tool;
        string version;
    }

    struct ValidateInvalidResult {
        bool success;
        bytes32 tool;
        string reason;
    }

    struct ListInput {
        string language;
        string category;
    }

    struct ListOkResult {
        bool success;
        bytes[] tools;
    }

    struct CapabilitiesOkResult {
        bool success;
        string[] capabilities;
    }

    // --- Events ---

    event ResolveCompleted(string variant, bytes32 tool, string[] capabilities, bytes invocation);
    event ValidateCompleted(string variant, bytes32 tool);
    event ListCompleted(string variant, bytes[] tools);
    event CapabilitiesCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice resolve - Finds a toolchain matching the given criteria, registers it if new.
    function resolve(string memory language, string memory platform, string memory versionConstraint, string memory category, string memory toolName) external returns (ResolveOkResult memory) {
        require(bytes(language).length > 0, "Language must not be empty");

        bytes32 toolId = keccak256(abi.encodePacked(language, platform, toolName));

        if (!_tools[toolId].exists) {
            string[] memory caps = new string[](1);
            caps[0] = toolName;

            _tools[toolId] = ToolRecord({
                language: language,
                platform: platform,
                version: versionConstraint,
                path: string(abi.encodePacked("/usr/local/bin/", toolName)),
                category: category,
                capabilities: caps,
                timestamp: block.timestamp,
                exists: true
            });
            _toolIds.push(toolId);
        }

        ToolRecord storage rec = _tools[toolId];
        bytes memory invocation = abi.encode(rec.path, rec.version);

        emit ResolveCompleted("ok", toolId, rec.capabilities, invocation);

        return ResolveOkResult({
            success: true,
            tool: toolId,
            version: rec.version,
            path: rec.path,
            capabilities: rec.capabilities,
            invocation: invocation
        });
    }

    /// @notice validate - Checks that a previously resolved tool is still valid.
    function validate(bytes32 tool) external returns (ValidateOkResult memory) {
        require(_tools[tool].exists, "Tool not found");

        ToolRecord storage rec = _tools[tool];

        emit ValidateCompleted("ok", tool);

        return ValidateOkResult({
            success: true,
            tool: tool,
            version: rec.version
        });
    }

    /// @notice list - Lists tools filtered by language and/or category.
    function list(string memory language, string memory category) external returns (ListOkResult memory) {
        uint256 count = 0;

        // First pass: count matches
        for (uint256 i = 0; i < _toolIds.length; i++) {
            ToolRecord storage rec = _tools[_toolIds[i]];
            bool langMatch = bytes(language).length == 0 ||
                keccak256(bytes(rec.language)) == keccak256(bytes(language));
            bool catMatch = bytes(category).length == 0 ||
                keccak256(bytes(rec.category)) == keccak256(bytes(category));
            if (langMatch && catMatch) {
                count++;
            }
        }

        // Second pass: collect matches
        bytes[] memory toolList = new bytes[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _toolIds.length; i++) {
            ToolRecord storage rec = _tools[_toolIds[i]];
            bool langMatch = bytes(language).length == 0 ||
                keccak256(bytes(rec.language)) == keccak256(bytes(language));
            bool catMatch = bytes(category).length == 0 ||
                keccak256(bytes(rec.category)) == keccak256(bytes(category));
            if (langMatch && catMatch) {
                toolList[idx] = abi.encode(_toolIds[i], rec.language, rec.version, rec.path);
                idx++;
            }
        }

        emit ListCompleted("ok", toolList);

        return ListOkResult({
            success: true,
            tools: toolList
        });
    }

    /// @notice capabilities - Returns the capabilities of a registered tool.
    function capabilities(bytes32 tool) external returns (CapabilitiesOkResult memory) {
        require(_tools[tool].exists, "Tool not found");

        ToolRecord storage rec = _tools[tool];

        emit CapabilitiesCompleted("ok", rec.capabilities);

        return CapabilitiesOkResult({
            success: true,
            capabilities: rec.capabilities
        });
    }

}
