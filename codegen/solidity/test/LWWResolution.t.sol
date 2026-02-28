// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LWWResolution.sol";

contract LWWResolutionTest is Test {
    LWWResolution public target;

    function setUp() public {
        target = new LWWResolution();
    }

    // --- register tests ---

    function test_register_returns_correct_name() public view {
        (string memory name,,) = target.register();
        assertEq(name, "lww");
    }

    function test_register_returns_correct_category() public view {
        (, string memory category,) = target.register();
        assertEq(category, "conflict-resolution");
    }

    function test_register_returns_correct_priority() public view {
        (,, uint256 priority) = target.register();
        assertEq(priority, 10);
    }

    // --- attemptResolve tests ---

    function test_attemptResolve_picks_later_timestamp() public view {
        bytes memory base = "";
        bytes memory v1 = abi.encode(uint256(100), bytes("data-old"));
        bytes memory v2 = abi.encode(uint256(200), bytes("data-new"));
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        assertEq(keccak256(result), keccak256(v2));
    }

    function test_attemptResolve_picks_v1_when_later() public view {
        bytes memory base = "";
        bytes memory v1 = abi.encode(uint256(500), bytes("data-later"));
        bytes memory v2 = abi.encode(uint256(100), bytes("data-earlier"));
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        assertEq(keccak256(result), keccak256(v1));
    }

    function test_attemptResolve_equal_timestamps_returns_cannotResolve() public view {
        bytes memory base = "";
        bytes memory v1 = abi.encode(uint256(100), bytes("data-a"));
        bytes memory v2 = abi.encode(uint256(100), bytes("data-b"));
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertFalse(resolved);
        assertEq(result.length, 0);
    }

    function test_attemptResolve_zero_vs_nonzero_timestamp() public view {
        bytes memory base = "";
        bytes memory v1 = abi.encode(uint256(0), bytes("genesis"));
        bytes memory v2 = abi.encode(uint256(1), bytes("after-genesis"));
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        assertEq(keccak256(result), keccak256(v2));
    }

    function test_attemptResolve_large_timestamps() public view {
        bytes memory base = "";
        bytes memory v1 = abi.encode(uint256(type(uint256).max - 1), bytes("almost-max"));
        bytes memory v2 = abi.encode(uint256(type(uint256).max), bytes("max"));
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        assertEq(keccak256(result), keccak256(v2));
    }
}
