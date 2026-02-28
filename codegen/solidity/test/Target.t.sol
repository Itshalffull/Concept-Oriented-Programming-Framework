// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Target.sol";

/// @title Target Conformance Tests
/// @notice Generated from concept invariants
contract TargetTest is Test {
    Target public target;

    function setUp() public {
        target = new Target();
    }

    /// @notice invariant 1: after generate, diff behaves correctly
    function test_invariant_1() public {
        bytes32 t = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 f = keccak256(abi.encodePacked("u-test-invariant-002"));

        // --- Setup ---
        // generate(projection: "test-projection", targetType: "rest", config: "{}") -> ok
        // target.generate("test-projection", "rest", "{}");
        // TODO: Assert ok variant

        // --- Assertions ---
        // diff(output: t) -> noPrevious
        // target.diff(t);
        // TODO: Assert noPrevious variant
    }

}
