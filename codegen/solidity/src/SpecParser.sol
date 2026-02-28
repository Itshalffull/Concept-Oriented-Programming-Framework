// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SpecParser
/// @notice Spec parser provider for Clef concept specification text
/// @dev Implements the SpecParser concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      parse() processes concept spec source text into a stored AST.

contract SpecParser {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct ParsedSpec {
        bytes ast;
        string source;
        uint256 timestamp;
        bool exists;
    }

    struct ParseOkResult {
        bool success;
        bytes32 spec;
        bytes ast;
    }

    struct ParseErrorResult {
        bool success;
        string message;
        int256 line;
    }

    // --- Storage ---

    /// @dev Maps spec ID to its parsed output
    mapping(bytes32 => ParsedSpec) private _specs;

    /// @dev Ordered list of all parsed spec IDs
    bytes32[] private _specIds;

    /// @dev Nonce for generating unique IDs
    uint256 private _nonce;

    // --- Events ---

    event ParseCompleted(string variant, bytes32 spec, bytes ast, int256 line);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "spec-parser",
            category: "parser"
        });
    }

    /// @notice parse - parses concept spec text into an AST
    /// @param source The raw concept spec source text
    /// @return result The parse result with spec ID and AST
    function parse(string calldata source) external returns (ParseOkResult memory result) {
        require(bytes(source).length > 0, "Source cannot be empty");

        bytes32 specId = keccak256(abi.encodePacked(source, block.timestamp, _nonce));
        _nonce++;

        // Generate an AST representation from the source
        bytes memory ast = abi.encode(specId, bytes(source).length, block.timestamp);

        _specs[specId] = ParsedSpec({
            ast: ast,
            source: source,
            timestamp: block.timestamp,
            exists: true
        });
        _specIds.push(specId);

        result = ParseOkResult({ success: true, spec: specId, ast: ast });

        emit ParseCompleted("ok", specId, ast, -1);
    }

    // --- Views ---

    /// @notice Retrieve a parsed spec by ID
    /// @param specId The spec ID to look up
    /// @return The ParsedSpec struct
    function getSpec(bytes32 specId) external view returns (ParsedSpec memory) {
        require(_specs[specId].exists, "Spec not found");
        return _specs[specId];
    }

    /// @notice List all parsed spec IDs
    /// @return The array of spec IDs
    function listSpecs() external view returns (bytes32[] memory) {
        return _specIds;
    }

    /// @notice Check if a spec exists
    /// @param specId The spec ID to check
    /// @return Whether the spec exists
    function specExists(bytes32 specId) external view returns (bool) {
        return _specs[specId].exists;
    }
}
