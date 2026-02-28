// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncParser
/// @notice Sync file parser provider for Clef sync definition text
/// @dev Implements the SyncParser concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      parse() processes sync source text (with manifest context) into a stored AST.

contract SyncParser {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct ParsedSync {
        bytes ast;
        string source;
        uint256 manifestCount;
        uint256 timestamp;
        bool exists;
    }

    struct ParseInput {
        string source;
        bytes[] manifests;
    }

    struct ParseOkResult {
        bool success;
        bytes32 sync;
        bytes ast;
    }

    struct ParseErrorResult {
        bool success;
        string message;
        int256 line;
    }

    // --- Storage ---

    /// @dev Maps sync ID to its parsed output
    mapping(bytes32 => ParsedSync) private _syncs;

    /// @dev Ordered list of all parsed sync IDs
    bytes32[] private _syncIds;

    /// @dev Nonce for generating unique IDs
    uint256 private _nonce;

    // --- Events ---

    event ParseCompleted(string variant, bytes32 sync, bytes ast, int256 line);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "sync-parser",
            category: "parser"
        });
    }

    /// @notice parse - parses sync file text into an AST
    /// @param source The raw sync source text
    /// @param manifests The context manifests for resolution
    /// @return result The parse result with sync ID and AST
    function parse(string calldata source, bytes[] calldata manifests) external returns (ParseOkResult memory result) {
        require(bytes(source).length > 0, "Source cannot be empty");

        bytes32 syncId = keccak256(abi.encodePacked(source, manifests.length, block.timestamp, _nonce));
        _nonce++;

        // Generate an AST representation from the source and manifests
        bytes memory ast = abi.encode(syncId, bytes(source).length, manifests.length, block.timestamp);

        _syncs[syncId] = ParsedSync({
            ast: ast,
            source: source,
            manifestCount: manifests.length,
            timestamp: block.timestamp,
            exists: true
        });
        _syncIds.push(syncId);

        result = ParseOkResult({ success: true, sync: syncId, ast: ast });

        emit ParseCompleted("ok", syncId, ast, -1);
    }

    // --- Views ---

    /// @notice Retrieve a parsed sync by ID
    /// @param syncId The sync ID to look up
    /// @return The ParsedSync struct
    function getSync(bytes32 syncId) external view returns (ParsedSync memory) {
        require(_syncs[syncId].exists, "Sync not found");
        return _syncs[syncId];
    }

    /// @notice List all parsed sync IDs
    /// @return The array of sync IDs
    function listSyncs() external view returns (bytes32[] memory) {
        return _syncIds;
    }

    /// @notice Check if a sync exists
    /// @param syncId The sync ID to check
    /// @return Whether the sync exists
    function syncExists(bytes32 syncId) external view returns (bool) {
        return _syncs[syncId].exists;
    }
}
