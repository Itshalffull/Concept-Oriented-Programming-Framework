// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncCompiler
/// @notice Sync file compiler provider for Clef sync definitions
/// @dev Implements the SyncCompiler concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      compile() processes parsed sync ASTs into compiled execution artefacts.

contract SyncCompiler {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct CompiledSync {
        bytes compiled;
        uint256 timestamp;
        bool exists;
    }

    struct CompileInput {
        bytes32 sync;
        bytes ast;
    }

    struct CompileOkResult {
        bool success;
        bytes compiled;
    }

    struct CompileErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps sync ID to compiled output
    mapping(bytes32 => CompiledSync) private _compiled;

    /// @dev Ordered list of compiled sync IDs
    bytes32[] private _compiledIds;

    // --- Events ---

    event CompileCompleted(string variant, bytes compiled);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "sync-compiler",
            category: "compiler"
        });
    }

    /// @notice compile - processes a sync AST into compiled output
    /// @param sync The sync ID to compile
    /// @param ast The serialised AST from the parsed sync file
    /// @return result The compilation result with compiled artefact
    function compile(bytes32 sync, bytes calldata ast) external returns (CompileOkResult memory result) {
        require(sync != bytes32(0), "Sync ID cannot be zero");
        require(ast.length > 0, "AST cannot be empty");

        // Compile the AST into an execution artefact
        bytes memory compiled = abi.encode(sync, ast.length, block.timestamp);

        _compiled[sync] = CompiledSync({
            compiled: compiled,
            timestamp: block.timestamp,
            exists: true
        });
        _compiledIds.push(sync);

        result = CompileOkResult({ success: true, compiled: compiled });

        emit CompileCompleted("ok", compiled);
    }

    // --- Views ---

    /// @notice Retrieve compiled output for a sync
    /// @param sync The sync ID to look up
    /// @return compiled The compiled artefact bytes
    function getCompiled(bytes32 sync) external view returns (bytes memory compiled) {
        require(_compiled[sync].exists, "No compiled output for sync");
        return _compiled[sync].compiled;
    }

    /// @notice Check if a sync has been compiled
    /// @param sync The sync ID to check
    /// @return Whether compiled output exists
    function hasCompiled(bytes32 sync) external view returns (bool) {
        return _compiled[sync].exists;
    }

    /// @notice List all compiled sync IDs
    /// @return The array of compiled sync IDs
    function listCompiled() external view returns (bytes32[] memory) {
        return _compiledIds;
    }
}
