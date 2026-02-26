// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Backlink.sol";

/// @title Backlink Conformance Tests
/// @notice Generated from concept invariants
contract BacklinkTest is Test {
    Backlink public target;

    function setUp() public {
        target = new Backlink();
    }

    /// @notice invariant 1: after reindex, getBacklinks behaves correctly
    function test_invariant_1() public {
        bytes32 n = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 x = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 s = keccak256(abi.encodePacked("u-test-invariant-003"));

        // --- Setup ---
        // reindex() -> ok
        // target.reindex();
        // TODO: Assert ok variant

        // --- Assertions ---
        // getBacklinks(entity: x) -> ok
        // target.getBacklinks(x);
        // TODO: Assert ok variant
    }

}
