// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Follow.sol";

/// @title Follow Conformance Tests
/// @notice Generated from concept invariants
contract FollowTest is Test {
    Follow public target;

    function setUp() public {
        target = new Follow();
    }

    /// @notice invariant 1: after follow, isFollowing, unfollow behaves correctly
    function test_invariant_1() public {
        bytes32 u = keccak256(abi.encodePacked("u-test-invariant-001"));

        // --- Setup ---
        // follow(user: u, target: "u2") -> ok
        // target.follow(u, "u2");
        // TODO: Assert ok variant

        // --- Assertions ---
        // isFollowing(user: u, target: "u2") -> ok
        // target.isFollowing(u, "u2");
        // TODO: Assert ok variant
        // unfollow(user: u, target: "u2") -> ok
        // target.unfollow(u, "u2");
        // TODO: Assert ok variant
    }

}
