// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Comment.sol";

/// @title Comment Conformance Tests
/// @notice Generated from concept invariants
contract CommentTest is Test {
    Comment public target;

    function setUp() public {
        target = new Comment();
    }

    /// @notice invariant 1: after create, delete behaves correctly
    function test_invariant_1() public {
        bytes32 c = keccak256(abi.encodePacked("u-test-invariant-001"));

        // --- Setup ---
        // create(comment: c, body: "Great post", target: "a1", author: "u1") -> ok
        // target.create(c, "Great post", "a1", "u1");
        // TODO: Assert ok variant

        // --- Assertions ---
        // delete(comment: c) -> ok
        // target.delete(c);
        // TODO: Assert ok variant
    }

}
