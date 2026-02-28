// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MultiValueResolution.sol";

contract MultiValueResolutionTest is Test {
    MultiValueResolution public target;

    function setUp() public {
        target = new MultiValueResolution();
    }

    // --- register tests ---

    function test_register_returns_correct_name() public view {
        (string memory name,,) = target.register();
        assertEq(name, "multi-value");
    }

    function test_register_returns_correct_category() public view {
        (, string memory category,) = target.register();
        assertEq(category, "conflict-resolution");
    }

    function test_register_returns_correct_priority() public view {
        (,, uint256 priority) = target.register();
        assertEq(priority, 30);
    }

    // --- attemptResolve tests ---

    function test_attemptResolve_preserves_both_values() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabb";
        bytes memory v2 = hex"ccdd";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);

        // Decode the result to verify both values are preserved
        (bytes memory decoded1, bytes memory decoded2) = abi.decode(result, (bytes, bytes));
        assertEq(keccak256(decoded1), keccak256(v1));
        assertEq(keccak256(decoded2), keccak256(v2));
    }

    function test_attemptResolve_always_resolves() public view {
        bytes memory base = hex"00";
        bytes memory v1 = hex"1111";
        bytes memory v2 = hex"2222";
        bytes memory context = hex"ff";

        (bool resolved,) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);
    }

    function test_attemptResolve_is_commutative() public view {
        bytes memory base = "";
        bytes memory v1 = hex"aabb";
        bytes memory v2 = hex"ccdd";
        bytes memory context = "";

        (bool resolved1, bytes memory result1) = target.attemptResolve(base, v1, v2, context);
        (bool resolved2, bytes memory result2) = target.attemptResolve(base, v2, v1, context);

        assertTrue(resolved1);
        assertTrue(resolved2);

        // Both orderings resolve, and both preserve both values
        (bytes memory r1a, bytes memory r1b) = abi.decode(result1, (bytes, bytes));
        (bytes memory r2a, bytes memory r2b) = abi.decode(result2, (bytes, bytes));

        // result1 has (v1, v2), result2 has (v2, v1)
        assertEq(keccak256(r1a), keccak256(r2b));
        assertEq(keccak256(r1b), keccak256(r2a));
    }

    function test_attemptResolve_empty_values() public view {
        bytes memory base = "";
        bytes memory v1 = "";
        bytes memory v2 = "";
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);

        (bytes memory decoded1, bytes memory decoded2) = abi.decode(result, (bytes, bytes));
        assertEq(decoded1.length, 0);
        assertEq(decoded2.length, 0);
    }

    function test_attemptResolve_preserves_large_data() public view {
        bytes memory base = "";
        bytes memory v1 = abi.encode("alice-version-with-lots-of-data");
        bytes memory v2 = abi.encode("bob-version-with-different-data");
        bytes memory context = "";

        (bool resolved, bytes memory result) = target.attemptResolve(base, v1, v2, context);

        assertTrue(resolved);

        (bytes memory decoded1, bytes memory decoded2) = abi.decode(result, (bytes, bytes));
        assertEq(keccak256(decoded1), keccak256(v1));
        assertEq(keccak256(decoded2), keccak256(v2));
    }
}
