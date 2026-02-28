// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AddWinsResolution
/// @notice Add-Wins (OR-Set semantics) conflict resolution provider
/// @dev Implements the AddWinsResolution concept from Clef specification.
///      Resolves conflicts using union semantics where all additions from
///      both concurrent versions are preserved in the result.

contract AddWinsResolution {
    // --- Events ---

    event Registered(string name, string category, uint256 priority);
    event Resolved(bytes result);

    // --- Actions ---

    /// @notice Register this resolution strategy and return its metadata
    /// @return name The strategy name ("add-wins")
    /// @return category The strategy category ("conflict-resolution")
    /// @return priority The strategy priority (20)
    function register() external pure returns (string memory name, string memory category, uint256 priority) {
        return ("add-wins", "conflict-resolution", 20);
    }

    /// @notice Attempt to resolve a conflict using add-wins (union) semantics
    /// @param base The common ancestor value
    /// @param v1 First concurrent value
    /// @param v2 Second concurrent value
    /// @param context Additional resolution context
    /// @return resolved Whether the conflict was resolved (always true)
    /// @return result The resolved value (union of v1 and v2)
    function attemptResolve(
        bytes calldata base,
        bytes calldata v1,
        bytes calldata v2,
        bytes calldata context
    ) external pure returns (bool resolved, bytes memory result) {
        // Suppress unused variable warnings
        base;
        context;

        // Union semantics: concatenate both values
        result = abi.encodePacked(v1, v2);
        return (true, result);
    }
}
