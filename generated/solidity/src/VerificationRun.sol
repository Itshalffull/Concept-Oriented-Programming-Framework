// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VerificationRun
/// @notice Generated from VerificationRun concept specification
/// @dev Skeleton contract — implement action bodies

contract VerificationRun {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private entries;

    // runs
    mapping(bytes32 => bool) private runs;
    bytes32[] private runsKeys;

    // --- Types ---

    struct StartInput {
        string target_symbol;
        string[] properties;
        string solver;
        int256 timeout_ms;
    }

    struct StartOkResult {
        bool success;
        bytes32 run;
    }

    struct StartInvalidResult {
        bool success;
        string message;
    }

    struct CompleteInput {
        bytes32 run;
        bytes results;
        bytes resource_usage;
    }

    struct CompleteOkResult {
        bool success;
        bytes32 run;
        int256 proved;
        int256 refuted;
        int256 unknown;
    }

    struct CompleteNotfoundResult {
        bool success;
        bytes32 run;
    }

    struct TimeoutInput {
        bytes32 run;
        bytes partial_results;
    }

    struct TimeoutOkResult {
        bool success;
        bytes32 run;
        int256 completed_count;
        int256 remaining_count;
    }

    struct CancelOkResult {
        bool success;
        bytes32 run;
    }

    struct Get_statusOkResult {
        bool success;
        bytes32 run;
        string status;
        uint256 progress;
    }

    struct CompareInput {
        bytes32 run1;
        bytes32 run2;
    }

    struct CompareOkResult {
        bool success;
        string[] regressions;
        string[] improvements;
        string[] unchanged;
    }

    // --- Events ---

    event StartCompleted(string variant, bytes32 run);
    event CompleteCompleted(string variant, bytes32 run, int256 proved, int256 refuted, int256 unknown);
    event TimeoutCompleted(string variant, bytes32 run, int256 completed_count, int256 remaining_count);
    event CancelCompleted(string variant, bytes32 run);
    event Get_statusCompleted(string variant, bytes32 run, uint256 progress);
    event CompareCompleted(string variant, string[] regressions, string[] improvements, string[] unchanged);

    // --- Actions ---

    /// @notice start
    function start(string memory target_symbol, string[] memory properties, string memory solver, int256 timeout_ms) external returns (StartOkResult memory) {
        // Invariant checks
        // invariant 1: after start, complete behaves correctly

        // TODO: Implement start
        revert("Not implemented");
    }

    /// @notice complete
    function complete(bytes32 run, bytes memory results, bytes memory resource_usage) external returns (CompleteOkResult memory) {
        // Invariant checks
        // invariant 1: after start, complete behaves correctly
        // require(..., "invariant 1: after start, complete behaves correctly");

        // TODO: Implement complete
        revert("Not implemented");
    }

    /// @notice timeout
    function timeout(bytes32 run, bytes memory partial_results) external returns (TimeoutOkResult memory) {
        // TODO: Implement timeout
        revert("Not implemented");
    }

    /// @notice cancel
    function cancel(bytes32 run) external returns (CancelOkResult memory) {
        // TODO: Implement cancel
        revert("Not implemented");
    }

    /// @notice get_status
    function get_status(bytes32 run) external returns (Get_statusOkResult memory) {
        // TODO: Implement get_status
        revert("Not implemented");
    }

    /// @notice compare
    function compare(bytes32 run1, bytes32 run2) external returns (CompareOkResult memory) {
        // TODO: Implement compare
        revert("Not implemented");
    }

}