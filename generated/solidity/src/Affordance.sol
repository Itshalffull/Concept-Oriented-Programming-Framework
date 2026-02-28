// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Affordance
/// @notice Generated from Affordance concept specification
/// @dev Skeleton contract — implement action bodies

contract Affordance {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private entries;

    // affordances
    mapping(bytes32 => bool) private affordances;
    bytes32[] private affordancesKeys;

    // --- Types ---

    struct DeclareInput {
        bytes32 affordance;
        string widget;
        string interactor;
        int256 specificity;
        string conditions;
    }

    struct DeclareOkResult {
        bool success;
        bytes32 affordance;
    }

    struct DeclareDuplicateResult {
        bool success;
        string message;
    }

    struct MatchInput {
        bytes32 affordance;
        string interactor;
        string context;
    }

    struct MatchOkResult {
        bool success;
        string matches;
    }

    struct MatchNoneResult {
        bool success;
        string message;
    }

    struct ExplainOkResult {
        bool success;
        bytes32 affordance;
        string reason;
    }

    struct ExplainNotfoundResult {
        bool success;
        string message;
    }

    struct RemoveOkResult {
        bool success;
        bytes32 affordance;
    }

    struct RemoveNotfoundResult {
        bool success;
        string message;
    }

    // --- Events ---

    event DeclareCompleted(string variant, bytes32 affordance);
    event MatchCompleted(string variant);
    event ExplainCompleted(string variant, bytes32 affordance);
    event RemoveCompleted(string variant, bytes32 affordance);

    // --- Actions ---

    /// @notice declare
    function declare(bytes32 affordance, string memory widget, string memory interactor, int256 specificity, string conditions) external returns (DeclareOkResult memory) {
        // Invariant checks
        // invariant 1: after declare, declare, match behaves correctly

        // TODO: Implement declare
        revert("Not implemented");
    }

    /// @notice match
    function match(bytes32 affordance, string memory interactor, string memory context) external returns (MatchOkResult memory) {
        // Invariant checks
        // invariant 1: after declare, declare, match behaves correctly
        // require(..., "invariant 1: after declare, declare, match behaves correctly");

        // TODO: Implement match
        revert("Not implemented");
    }

    /// @notice explain
    function explain(bytes32 affordance) external returns (ExplainOkResult memory) {
        // TODO: Implement explain
        revert("Not implemented");
    }

    /// @notice remove
    function remove(bytes32 affordance) external returns (RemoveOkResult memory) {
        // TODO: Implement remove
        revert("Not implemented");
    }

}
