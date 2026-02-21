// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AccessControl
/// @notice Concept-oriented access control combinators with three-valued logic (Allowed, Neutral, Forbidden)
/// @dev Implements the AccessControl concept from COPF specification.
///      Provides pure computation functions for combining access decisions.
///      AccessResult values: 0 = Allowed, 1 = Neutral, 2 = Forbidden.

contract AccessControl {
    // --- Types ---

    /// @dev Access decision results
    ///      Allowed  = 0: Access is explicitly granted
    ///      Neutral  = 1: No opinion (defer to other rules)
    ///      Forbidden = 2: Access is explicitly denied
    enum AccessResult { Allowed, Neutral, Forbidden }

    // --- Events ---

    event AccessChecked(bytes32 indexed entityId, bytes32 indexed userId, uint8 result);

    // --- Pure Combinators ---

    /// @notice OR combinator: Forbidden if either is Forbidden, else Allowed if either is Allowed
    /// @param a First access result (uint8 representation of AccessResult)
    /// @param b Second access result (uint8 representation of AccessResult)
    /// @return The combined access result
    function orIf(uint8 a, uint8 b) external pure returns (uint8) {
        require(a <= 2, "Invalid access result a");
        require(b <= 2, "Invalid access result b");

        // Forbidden overrides everything
        if (a == uint8(AccessResult.Forbidden) || b == uint8(AccessResult.Forbidden)) {
            return uint8(AccessResult.Forbidden);
        }

        // Allowed if either is Allowed
        if (a == uint8(AccessResult.Allowed) || b == uint8(AccessResult.Allowed)) {
            return uint8(AccessResult.Allowed);
        }

        // Both are Neutral
        return uint8(AccessResult.Neutral);
    }

    /// @notice AND combinator: Allowed only if both are Allowed
    /// @param a First access result (uint8 representation of AccessResult)
    /// @param b Second access result (uint8 representation of AccessResult)
    /// @return The combined access result
    function andIf(uint8 a, uint8 b) external pure returns (uint8) {
        require(a <= 2, "Invalid access result a");
        require(b <= 2, "Invalid access result b");

        // Forbidden overrides everything
        if (a == uint8(AccessResult.Forbidden) || b == uint8(AccessResult.Forbidden)) {
            return uint8(AccessResult.Forbidden);
        }

        // Allowed only if both are Allowed
        if (a == uint8(AccessResult.Allowed) && b == uint8(AccessResult.Allowed)) {
            return uint8(AccessResult.Allowed);
        }

        // Otherwise Neutral
        return uint8(AccessResult.Neutral);
    }
}
