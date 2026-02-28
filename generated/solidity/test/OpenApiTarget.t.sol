// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/OpenApiTarget.sol";

/// @title OpenApiTarget Conformance Tests
/// @notice Generated from concept invariants
contract OpenApiTargetTest is Test {
    OpenApiTarget public target;

    function setUp() public {
        target = new OpenApiTarget();
    }

    /// @notice invariant 1: after generate, generate behaves correctly
    function test_invariant_1() public {
        bytes32 o = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 c = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 o2 = keccak256(abi.encodePacked("u-test-invariant-003"));
        bytes32 c2 = keccak256(abi.encodePacked("u-test-invariant-004"));

        // --- Setup ---
        // generate(projections: ["proj-1", "proj-2"], config: "{}") -> ok
        // target.generate(/* ["proj-1", "proj-2"] */, "{}");
        // TODO: Assert ok variant

        // --- Assertions ---
        // generate(projections: ["proj-1"], config: "{}") -> ok
        // target.generate(/* ["proj-1"] */, "{}");
        // TODO: Assert ok variant
    }

}
