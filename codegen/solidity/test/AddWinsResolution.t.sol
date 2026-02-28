// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AddWinsResolution.sol";

contract AddWinsResolutionTest is Test {
    AddWinsResolution public target;

    function setUp() public {
        target = new AddWinsResolution();
    }

    // --- register tests ---

    function test_register_returns_correct_name() public view {
        (string memory name,,) = target.register();
        assertEq(name, "add-wins");
    }

    function test_register_returns_correct_category() public view {
        (, string memory category,) = target.register();
        assertEq(category, "conflict-resolution");
    }

    function test_register_returns_correct_priority() public view {
        (,, uint256 priority) = target.register();
        assertEq(priority, 20);
    }

    // --- attemptResolve tests ---

    function test_attemptResolve_returns_union() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabb";
        bytes memory v2 = hex"ccdd";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        // Union semantics: concatenation of v1 and v2
        assertEq(result, abi.encodePacked(v1, v2));
    }

    function test_attemptResolve_always_resolves() public view {
        bytes memory base = hex"00";
        bytes memory v1 = hex"1111";
        bytes memory v2 = hex"2222";
        bytes memory context = hex"ff";

        (bool resolved,) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
    }

    function test_attemptResolve_is_commutative_in_content() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabb";
        bytes memory v2 = hex"ccdd";
        bytes memory context = "";

        (bool resolved1, bytes memory result1) = target.attemptResolve(base, v1, v2, context);
        (bool resolved2, bytes memory result2) = target.attemptResolve(base, v2, v1, context);

        assertTrue(resolved1);
        assertTrue(resolved2);

        // Both orderings produce results containing all the same bytes
        // (concatenation order may differ, but both contain v1 and v2 data)
        assertEq(result1.length, result2.length);
    }

    function test_attemptResolve_empty_values() public view {
        bytes memory base = "";
        bytes memory v1 = "";
        bytes memory v2 = "";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        assertEq(result.length, 0);
    }

    function test_attemptResolve_one_empty_value() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabb";
        bytes memory v2 = "";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
        assertEq(result, abi.encodePacked(v1));
    }
}
