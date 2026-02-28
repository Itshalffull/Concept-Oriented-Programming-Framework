// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ManualResolution.sol";

contract ManualResolutionTest is Test {
    ManualResolution public target;

    function setUp() public {
        target = new ManualResolution();
    }

    // --- register tests ---

    function test_register_returns_correct_name() public view {
        (string memory name,,) = target.register();
        assertEq(name, "manual");
    }

    function test_register_returns_correct_category() public view {
        (, string memory category,) = target.register();
        assertEq(category, "conflict-resolution");
    }

    function test_register_returns_correct_priority() public view {
        (,, uint256 priority) = target.register();
        assertEq(priority, 99);
    }

    // --- attemptResolve tests ---

    function test_attemptResolve_always_returns_false() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabb";
        bytes memory v2 = hex"ccdd";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertFalse(resolved);
        assertEq(result.length, 0);
    }

    function test_attemptResolve_returns_false_with_real_data() public view {
        bytes memory base = abi.encode("base-state");
        bytes memory v1 = abi.encode("alice-edit");
        bytes memory v2 = abi.encode("bob-edit");
        bytes memory context = abi.encode("merge-context");

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertFalse(resolved);
        assertEq(result.length, 0);
    }

    function test_attemptResolve_returns_false_with_empty_values() public view {
        bytes memory base = "";
        bytes memory v1 = "";
        bytes memory v2 = "";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertFalse(resolved);
        assertEq(result.length, 0);
    }

    function test_attemptResolve_returns_false_with_identical_values() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabbccdd";
        bytes memory v2 = hex"aabbccdd";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertFalse(resolved);
        assertEq(result.length, 0);
    }

    function test_attemptResolve_returns_false_with_large_data() public view {
        bytes memory base = new bytes(1024);
        bytes memory v1 = new bytes(1024);
        bytes memory v2 = new bytes(1024);
        bytes memory context = new bytes(256);

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertFalse(resolved);
        assertEq(result.length, 0);
    }
}
