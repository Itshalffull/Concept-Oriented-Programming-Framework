// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Ref.sol";

/// @title Ref Conformance Tests
/// @notice Generated from concept invariants
contract RefTest is Test {
    Ref public target;

    function setUp() public {
        target = new Ref();
    }

    /// @notice invariant 1: after create, resolve behaves correctly
    function test_invariant_1() public {
        bytes32 n = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 h = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 r = keccak256(abi.encodePacked("u-test-invariant-003"));

        // --- Setup ---
        // create(name: n, hash: h) -> ok
        // target.create(n, h);
        // TODO: Assert ok variant

        // --- Assertions ---
        // resolve(name: n) -> ok
        // target.resolve(n);
        // TODO: Assert ok variant
    }

    /// @notice invariant 2: after update, resolve behaves correctly
    function test_invariant_2() public {
        bytes32 n = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 h2 = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 h1 = keccak256(abi.encodePacked("u-test-invariant-003"));

        // --- Setup ---
        // update(name: n, newHash: h2, expectedOldHash: h1) -> ok
        // target.update(n, h2, h1);
        // TODO: Assert ok variant

        // --- Assertions ---
        // resolve(name: n) -> ok
        // target.resolve(n);
        // TODO: Assert ok variant
    }

}
