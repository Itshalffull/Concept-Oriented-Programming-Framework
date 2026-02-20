// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/User.sol";

/// @title User Conformance Tests
/// @notice Generated from concept invariants
contract UserTest is Test {
    User public target;

    function setUp() public {
        target = new User();
    }

    /// @notice invariant 1: after register, register behaves correctly
    function test_invariant_1() public {
        bytes32 x = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 y = keccak256(abi.encodePacked("u-test-invariant-002"));

        // --- Setup ---
        // register(user: x, name: "alice", email: "a@b.com") -> ok
        // target.register(x, "alice", "a@b.com");
        // TODO: Assert ok variant

        // --- Assertions ---
        // register(user: y, name: "alice", email: "c@d.com") -> error
        // target.register(y, "alice", "c@d.com");
        // TODO: Assert error variant
    }

}
