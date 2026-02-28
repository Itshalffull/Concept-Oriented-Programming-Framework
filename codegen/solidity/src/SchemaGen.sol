// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SchemaGen
/// @notice Schema generator provider for Clef concept specifications
/// @dev Implements the SchemaGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces schema (manifest) from a parsed AST.

contract SchemaGen {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct GeneratedSchema {
        bytes manifest;
        uint256 timestamp;
        bool exists;
    }

    struct GenerateInput {
        bytes32 spec;
        bytes ast;
    }

    struct GenerateOkResult {
        bool success;
        bytes manifest;
    }

    struct GenerateErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps spec ID to generated schema
    mapping(bytes32 => GeneratedSchema) private _schemas;

    /// @dev Ordered list of spec IDs that have schemas generated
    bytes32[] private _schemaIds;

    // --- Events ---

    event GenerateCompleted(string variant, bytes manifest);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "schema-gen",
            category: "code-generator"
        });
    }

    /// @notice generate - produces a schema manifest from a spec AST
    /// @param spec The spec ID to generate schema for
    /// @param ast The serialised AST from the parsed spec
    /// @return result The generation result with produced manifest
    function generate(bytes32 spec, bytes calldata ast) external returns (GenerateOkResult memory result) {
        require(spec != bytes32(0), "Spec ID cannot be zero");
        require(ast.length > 0, "AST cannot be empty");

        // Generate a manifest from the AST
        bytes memory manifest = abi.encode(spec, ast.length, block.timestamp);

        _schemas[spec] = GeneratedSchema({
            manifest: manifest,
            timestamp: block.timestamp,
            exists: true
        });
        _schemaIds.push(spec);

        result = GenerateOkResult({ success: true, manifest: manifest });

        emit GenerateCompleted("ok", manifest);
    }

    // --- Views ---

    /// @notice Retrieve generated schema for a spec
    /// @param spec The spec ID to look up
    /// @return manifest The generated manifest bytes
    function getSchema(bytes32 spec) external view returns (bytes memory manifest) {
        require(_schemas[spec].exists, "No schema generated for spec");
        return _schemas[spec].manifest;
    }

    /// @notice Check if a schema has been generated for a spec
    /// @param spec The spec ID to check
    /// @return Whether a schema exists
    function hasSchema(bytes32 spec) external view returns (bool) {
        return _schemas[spec].exists;
    }
}
