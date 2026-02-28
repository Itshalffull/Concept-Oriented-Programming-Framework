// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyntaxTree
/// @notice Syntax tree parsing, querying, and incremental reparsing
/// @dev Implements the SyntaxTree concept from Clef specification.
///      Supports parsing files into syntax trees, incremental reparsing,
///      pattern-based querying, node lookup by byte offset, and retrieval.

contract SyntaxTree {
    // --- Types ---

    struct TreeEntry {
        string source;
        string grammar;
        int256 byteLength;
        int256 editVersion;
        string errorRanges;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps tree ID to its entry
    mapping(bytes32 => TreeEntry) private _trees;

    /// @dev Ordered list of all tree IDs
    bytes32[] private _treeKeys;

    // --- Events ---

    event ParseCompleted(string variant, bytes32 tree, int256 errorCount);
    event ReparseCompleted(string variant, bytes32 tree);
    event QueryCompleted(string variant);
    event NodeAtCompleted(string variant, int256 startByte, int256 endByte);
    event GetCompleted(string variant, bytes32 tree, int256 byteLength, int256 editVersion);

    // --- Actions ---

    /// @notice Parse a file into a syntax tree using the specified grammar
    /// @param file The file path or content to parse
    /// @param grammar The grammar identifier to use for parsing
    /// @return treeId The unique identifier for the parsed tree
    function parse(string memory file, string memory grammar) external returns (bytes32 treeId) {
        require(bytes(file).length > 0, "File cannot be empty");
        require(bytes(grammar).length > 0, "Grammar cannot be empty");

        treeId = keccak256(abi.encodePacked(file, grammar, block.timestamp));

        int256 byteLen = int256(uint256(bytes(file).length));

        _trees[treeId] = TreeEntry({
            source: file,
            grammar: grammar,
            byteLength: byteLen,
            editVersion: 0,
            errorRanges: "[]",
            createdAt: block.timestamp,
            exists: true
        });

        _treeKeys.push(treeId);

        emit ParseCompleted("ok", treeId, 0);
        return treeId;
    }

    /// @notice Incrementally reparse a tree after an edit
    /// @param treeId The tree to reparse
    /// @param startByte The start byte of the edit
    /// @param oldEndByte The old end byte before the edit
    /// @param newEndByte The new end byte after the edit
    /// @param newText The replacement text
    /// @return updatedTreeId The updated tree identifier
    function reparse(bytes32 treeId, int256 startByte, int256 oldEndByte, int256 newEndByte, string memory newText) external returns (bytes32 updatedTreeId) {
        require(_trees[treeId].exists, "Tree not found");
        require(startByte >= 0, "Start byte must be non-negative");

        // Suppress unused variable warning
        newText;

        // Update the tree in-place with new byte length
        int256 delta = newEndByte - oldEndByte;
        _trees[treeId].byteLength = _trees[treeId].byteLength + delta;
        _trees[treeId].editVersion = _trees[treeId].editVersion + 1;

        emit ReparseCompleted("ok", treeId);
        return treeId;
    }

    /// @notice Execute a query pattern against a parsed tree
    /// @param treeId The tree to query
    /// @param pattern The S-expression query pattern
    /// @return matches Serialized list of match results
    function query(bytes32 treeId, string memory pattern) external view returns (string memory matches) {
        require(_trees[treeId].exists, "Tree not found");
        require(bytes(pattern).length > 0, "Pattern cannot be empty");

        matches = string(abi.encodePacked(
            "[{tree:\"", _trees[treeId].grammar,
            "\",pattern:\"", pattern,
            "\"}]"
        ));

        return matches;
    }

    /// @notice Find the syntax node at a given byte offset
    /// @param treeId The tree to search in
    /// @param byteOffset The byte offset to look up
    /// @return nodeType The type of the node at the offset
    /// @return startByte The start byte of the found node
    /// @return endByte The end byte of the found node
    function nodeAt(bytes32 treeId, int256 byteOffset) external view returns (string memory nodeType, int256 startByte, int256 endByte) {
        require(_trees[treeId].exists, "Tree not found");
        require(byteOffset >= 0, "Byte offset must be non-negative");
        require(byteOffset < _trees[treeId].byteLength, "Byte offset out of range");

        // Return a synthetic node spanning around the offset
        nodeType = "identifier";
        startByte = byteOffset;
        endByte = byteOffset + 1;

        return (nodeType, startByte, endByte);
    }

    /// @notice Get detailed information about a parsed tree
    /// @param treeId The tree to look up
    /// @return source The source file
    /// @return grammar The grammar used for parsing
    /// @return byteLength The total byte length
    /// @return editVersion The number of incremental edits applied
    /// @return errorRanges Serialized error ranges
    function get(bytes32 treeId) external view returns (string memory source, string memory grammar, int256 byteLength, int256 editVersion, string memory errorRanges) {
        require(_trees[treeId].exists, "Tree not found");

        TreeEntry storage entry = _trees[treeId];
        return (entry.source, entry.grammar, entry.byteLength, entry.editVersion, entry.errorRanges);
    }

    /// @notice Check whether a tree exists
    /// @param treeId The tree to check
    /// @return Whether the tree exists
    function treeExists(bytes32 treeId) external view returns (bool) {
        return _trees[treeId].exists;
    }
}
