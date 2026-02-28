// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OpenApiTarget
/// @notice Spec-target provider that generates OpenAPI specifications from projections.
/// @dev Merges multiple projections into a single OpenAPI 3.0 spec document.

contract OpenApiTarget {

    // --- Storage ---

    /// @dev Maps spec hash to whether it has been generated
    mapping(bytes32 => bool) private specs;
    bytes32[] private specsKeys;

    /// @dev Maps spec hash to its content
    mapping(bytes32 => string) private specContents;

    /// @dev Tracks which projections were used for each spec
    mapping(bytes32 => bytes) private specProjections;

    // --- Types ---

    struct GenerateInput {
        string[] projections;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 spec;
        string content;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 spec);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    /// @return name The provider name.
    /// @return category The provider category.
    /// @return formats The supported output formats.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory formats)
    {
        name = "openapi";
        category = "spec-target";
        formats = new string[](2);
        formats[0] = "yaml";
        formats[1] = "json";
    }

    // --- Actions ---

    /// @notice Generate an OpenAPI spec from projections
    function generate(string[] memory projections, string memory config) external returns (GenerateOkResult memory) {
        require(projections.length > 0, "At least one projection required");

        // Derive a deterministic spec hash from the input projections and config
        bytes32 specHash = keccak256(abi.encode(projections, config));

        // Build a placeholder content string representing the generated spec
        string memory content = string(abi.encodePacked(
            '{"openapi":"3.0.3","paths":',
            _uint2str(projections.length),
            "}"
        ));

        // Store the spec
        if (!specs[specHash]) {
            specs[specHash] = true;
            specsKeys.push(specHash);
        }
        specContents[specHash] = content;
        specProjections[specHash] = abi.encode(projections);

        emit GenerateCompleted("ok", specHash);

        return GenerateOkResult({
            success: true,
            spec: specHash,
            content: content
        });
    }

    // --- Internal helpers ---

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

}
