// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PessimisticLock.sol";

/// @title PessimisticLock Conformance Tests
/// @notice Generated from concept invariants
contract PessimisticLockTest is Test {
    PessimisticLock public target;

    function setUp() public {
        target = new PessimisticLock();
    }

    /// @notice invariant 1: after checkOut, checkOut behaves correctly
    function test_invariant_1() public {
        bytes32 r = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 h = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 l = keccak256(abi.encodePacked("u-test-invariant-003"));

        // --- Setup ---
        // checkOut(resource: r, holder: h, duration: _, reason: _) -> ok
        // target.checkOut(r, h, _, _);
        // TODO: Assert ok variant

        // --- Assertions ---
        // checkOut(resource: r, holder: "other-user", duration: _, reason: _) -> alreadyLocked
        // target.checkOut(r, "other-user", _, _);
        // TODO: Assert alreadyLocked variant
    }

    /// @notice invariant 2: after checkOut, checkIn, checkOut behaves correctly
    function test_invariant_2() public {
        bytes32 r = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 h = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 l = keccak256(abi.encodePacked("u-test-invariant-003"));

        // --- Setup ---
        // checkOut(resource: r, holder: h, duration: _, reason: _) -> ok
        // target.checkOut(r, h, _, _);
        // TODO: Assert ok variant

        // --- Assertions ---
        // checkIn(lockId: l) -> ok
        // target.checkIn(l);
        // TODO: Assert ok variant
        // checkOut(resource: r, holder: "other-user", duration: _, reason: _) -> ok
        // target.checkOut(r, "other-user", _, _);
        // TODO: Assert ok variant
    }

}
