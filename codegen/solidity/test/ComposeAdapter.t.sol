// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ComposeAdapter.sol";

/// @title ComposeAdapter Conformance Tests
/// @notice Generated from concept invariants
contract ComposeAdapterTest is Test {
    ComposeAdapter public target;

    function setUp() public {
        target = new ComposeAdapter();
    }

    /// @notice invariant 1: after normalize, normalize behaves correctly
    function test_invariant_1() public {
        bytes32 a = keccak256(abi.encodePacked("u-test-invariant-001"));

        // --- Setup ---
        // normalize(adapter: a, props: "{ \"onclick\": \"handler_1\", \"class\": \"btn\" }") -> ok
        // target.normalize(a, "{ "onclick": "handler_1", "class": "btn" }");
        // TODO: Assert ok variant

        // --- Assertions ---
        // normalize(adapter: a, props: "") -> error
        // target.normalize(a, "");
        // TODO: Assert error variant
    }

}
