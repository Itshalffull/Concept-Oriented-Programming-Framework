// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LWWResolution
/// @notice Last-Writer-Wins conflict resolution using timestamps
/// @dev Implements the LWWResolution concept from Clef specification.
///      Resolves conflicts by comparing timestamps embedded in values
///      and selecting the value with the later timestamp.

contract LWWResolution {
    // --- Events ---

    event Registered(string name, string category, uint256 priority);
    event Resolved(bytes result);

    // --- Actions ---

    /// @notice Register this resolution strategy and return its metadata
    /// @return name The strategy name ("lww")
    /// @return category The strategy category ("conflict-resolution")
    /// @return priority The strategy priority (10)
    function register() external pure returns (string memory name, string memory category, uint256 priority) {
        return ("lww", "conflict-resolution", 10);
    }

    /// @notice Attempt to resolve a conflict using last-writer-wins semantics
    /// @dev v1 and v2 must be abi.encode(uint256 timestamp, bytes data)
    /// @param base The common ancestor value
    /// @param v1 First concurrent value (abi.encoded timestamp + data)
    /// @param v2 Second concurrent value (abi.encoded timestamp + data)
    /// @param context Additional resolution context
    /// @return resolved Whether the conflict was resolved
    /// @return result The resolved value (the one with the later timestamp)
    function attemptResolve(
        bytes calldata base,
        bytes calldata v1,
        bytes calldata v2,
        bytes calldata context
    ) external pure returns (bool resolved, bytes memory result) {
        // Suppress unused variable warnings
        base;
        context;

        // Decode timestamps from both values
        (uint256 ts1,) = abi.decode(v1, (uint256, bytes));
        (uint256 ts2,) = abi.decode(v2, (uint256, bytes));

        // If timestamps are equal, cannot resolve
        if (ts1 == ts2) {
            return (false, "");
        }

        // Pick the value with the later timestamp
        if (ts1 > ts2) {
            return (true, v1);
        } else {
            return (true, v2);
        }
    }
}
