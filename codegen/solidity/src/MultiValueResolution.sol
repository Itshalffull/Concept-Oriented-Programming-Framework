// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MultiValueResolution
/// @notice Keep-all resolution that preserves both concurrent values
/// @dev Implements the MultiValueResolution concept from Clef specification.
///      Resolves conflicts by encoding both values together, preserving
///      all concurrent versions for downstream consumers to handle.

contract MultiValueResolution {
    // --- Events ---

    event Registered(string name, string category, uint256 priority);
    event Resolved(bytes result);

    // --- Actions ---

    /// @notice Register this resolution strategy and return its metadata
    /// @return name The strategy name ("multi-value")
    /// @return category The strategy category ("conflict-resolution")
    /// @return priority The strategy priority (30)
    function register() external pure returns (string memory name, string memory category, uint256 priority) {
        return ("multi-value", "conflict-resolution", 30);
    }

    /// @notice Attempt to resolve a conflict by preserving both values
    /// @param base The common ancestor value
    /// @param v1 First concurrent value
    /// @param v2 Second concurrent value
    /// @param context Additional resolution context
    /// @return resolved Whether the conflict was resolved (always true)
    /// @return result The resolved value containing both v1 and v2
    function attemptResolve(
        bytes calldata base,
        bytes calldata v1,
        bytes calldata v2,
        bytes calldata context
    ) external pure returns (bool resolved, bytes memory result) {
        // Suppress unused variable warnings
        base;
        context;

        // Preserve both values by encoding them together
        result = abi.encode(v1, v2);
        return (true, result);
    }
}
