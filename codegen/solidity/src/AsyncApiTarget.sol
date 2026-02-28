// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AsyncApiTarget
/// @notice Spec-target provider that generates AsyncAPI specifications from projections.
/// @dev Converts synchronous API specs into asynchronous event-driven API definitions.

contract AsyncApiTarget {

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
        string[] syncSpecs;
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
        name = "asyncapi";
        category = "spec-target";
        formats = new string[](2);
        formats[0] = "yaml";
        formats[1] = "json";
    }

    // --- Actions ---

    /// @notice Generate an AsyncAPI spec from projections and sync specs
    function generate(string[] memory projections, string[] memory syncSpecs, string memory config) external returns (GenerateOkResult memory) {
        require(projections.length > 0, "At least one projection required");

        // Derive a deterministic spec hash from the input projections and config
        bytes32 specHash = keccak256(abi.encode(projections, syncSpecs, config));

        // Build a placeholder content string representing the generated async spec
        string memory content = string(abi.encodePacked(
            '{"asyncapi":"2.6.0","projections":',
            _uint2str(projections.length),
            ',"syncSpecs":',
            _uint2str(syncSpecs.length),
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
