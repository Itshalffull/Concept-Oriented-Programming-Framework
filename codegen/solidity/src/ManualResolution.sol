// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ManualResolution
/// @notice Manual conflict resolution that always escalates to human intervention
/// @dev Implements the ManualResolution concept from Clef specification.
///      Always returns cannotResolve, indicating the conflict requires
///      human decision-making and cannot be automatically resolved.

contract ManualResolution {
    // --- Events ---

    event Registered(string name, string category, uint256 priority);
    event CannotResolve();

    // --- Actions ---

    /// @notice Register this resolution strategy and return its metadata
    /// @return name The strategy name ("manual")
    /// @return category The strategy category ("conflict-resolution")
    /// @return priority The strategy priority (99)
    function register() external pure returns (string memory name, string memory category, uint256 priority) {
        return ("manual", "conflict-resolution", 99);
    }

    /// @notice Attempt to resolve a conflict - always returns cannotResolve
    /// @param base The common ancestor value
    /// @param v1 First concurrent value
    /// @param v2 Second concurrent value
    /// @param context Additional resolution context
    /// @return resolved Always false (manual resolution required)
    /// @return result Always empty (no automatic resolution)
    function attemptResolve(
        bytes calldata base,
        bytes calldata v1,
        bytes calldata v2,
        bytes calldata context
    ) external pure returns (bool resolved, bytes memory result) {
        // Suppress unused variable warnings
        base;
        v1;
        v2;
        context;

        // Manual resolution always escalates to human
        return (false, "");
    }
}
