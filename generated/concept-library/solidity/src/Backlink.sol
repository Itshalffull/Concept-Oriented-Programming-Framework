// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Backlink
/// @notice Generated from Backlink concept specification
/// @dev Skeleton contract — implement action bodies

contract Backlink {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private entries;

    // --- Types ---

    struct GetBacklinksOkResult {
        bool success;
        string sources;
    }

    struct GetUnlinkedMentionsOkResult {
        bool success;
        string mentions;
    }

    struct ReindexOkResult {
        bool success;
        int256 count;
    }

    // --- Events ---

    event GetBacklinksCompleted(string variant);
    event GetUnlinkedMentionsCompleted(string variant);
    event ReindexCompleted(string variant, int256 count);

    // --- Actions ---

    /// @notice getBacklinks
    function getBacklinks(bytes32 entity) external returns (GetBacklinksOkResult memory) {
        // Invariant checks
        // invariant 1: after reindex, getBacklinks behaves correctly
        // require(..., "invariant 1: after reindex, getBacklinks behaves correctly");

        // TODO: Implement getBacklinks
        revert("Not implemented");
    }

    /// @notice getUnlinkedMentions
    function getUnlinkedMentions(bytes32 entity) external returns (GetUnlinkedMentionsOkResult memory) {
        // TODO: Implement getUnlinkedMentions
        revert("Not implemented");
    }

    /// @notice reindex
    function reindex() external returns (ReindexOkResult memory) {
        // Invariant checks
        // invariant 1: after reindex, getBacklinks behaves correctly

        // TODO: Implement reindex
        revert("Not implemented");
    }

}
