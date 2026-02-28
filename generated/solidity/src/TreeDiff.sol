// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TreeDiff
/// @notice Generated from TreeDiff concept specification
/// @dev Skeleton contract — implement action bodies

contract TreeDiff {

    // --- Storage (from concept state) ---

    // cache
    mapping(bytes32 => bool) private cache;
    bytes32[] private cacheKeys;

    // --- Types ---

    struct RegisterOkResult {
        bool success;
        string name;
        string category;
        string[] contentTypes;
    }

    struct ComputeInput {
        bytes contentA;
        bytes contentB;
    }

    struct ComputeOkResult {
        bool success;
        bytes editScript;
        int256 distance;
    }

    struct ComputeUnsupportedContentResult {
        bool success;
        string message;
    }

    // --- Events ---

    event RegisterCompleted(string variant, string[] contentTypes);
    event ComputeCompleted(string variant, int256 distance);

    // --- Actions ---

    /// @notice register
    function register() external returns (RegisterOkResult memory) {
        // TODO: Implement register
        revert("Not implemented");
    }

    /// @notice compute
    function compute(bytes memory contentA, bytes memory contentB) external returns (ComputeOkResult memory) {
        // Invariant checks
        // invariant 1: after compute, compute behaves correctly
        // require(..., "invariant 1: after compute, compute behaves correctly");

        // TODO: Implement compute
        revert("Not implemented");
    }

}
