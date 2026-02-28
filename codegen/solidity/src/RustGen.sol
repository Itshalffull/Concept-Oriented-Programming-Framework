// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RustGen
/// @notice Rust code generator provider for Clef concept specifications
/// @dev Implements the RustGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() stores generated Rust code files keyed by spec ID.

contract RustGen {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
        string language;
    }

    struct GeneratedOutput {
        bytes[] files;
        uint256 timestamp;
        bool exists;
    }

    struct GenerateInput {
        bytes32 spec;
        bytes manifest;
    }

    struct GenerateOkResult {
        bool success;
        bytes[] files;
    }

    struct GenerateErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps spec ID to generated output
    mapping(bytes32 => GeneratedOutput) private _generated;

    /// @dev Ordered list of spec IDs that have been generated
    bytes32[] private _generatedIds;

    // --- Events ---

    event GenerateCompleted(string variant, bytes[] files);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category, language)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "rust-gen",
            category: "code-generator",
            language: "rust"
        });
    }

    /// @notice generate - produces Rust code files from a spec and manifest
    /// @param spec The spec ID to generate code for
    /// @param manifest The serialised concept manifest
    /// @return result The generation result with produced files
    function generate(bytes32 spec, bytes calldata manifest) external returns (GenerateOkResult memory result) {
        require(spec != bytes32(0), "Spec ID cannot be zero");
        require(manifest.length > 0, "Manifest cannot be empty");

        // Generate a placeholder Rust file from the manifest
        bytes[] memory files = new bytes[](1);
        files[0] = abi.encodePacked(
            "// Generated Rust code for spec: ", abi.encodePacked(spec),
            "\n// Manifest size: ", abi.encodePacked(manifest.length)
        );

        _generated[spec] = GeneratedOutput({
            files: files,
            timestamp: block.timestamp,
            exists: true
        });
        _generatedIds.push(spec);

        result = GenerateOkResult({ success: true, files: files });

        emit GenerateCompleted("ok", files);
    }

    // --- Views ---

    /// @notice Retrieve generated output for a spec
    /// @param spec The spec ID to look up
    /// @return files The generated files
    function getGenerated(bytes32 spec) external view returns (bytes[] memory files) {
        require(_generated[spec].exists, "No generated output for spec");
        return _generated[spec].files;
    }

    /// @notice Check if output has been generated for a spec
    /// @param spec The spec ID to check
    /// @return Whether generated output exists
    function hasGenerated(bytes32 spec) external view returns (bool) {
        return _generated[spec].exists;
    }
}
