// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Machine.sol";

/// @title Machine Conformance Tests
/// @notice Generated from concept invariants
contract MachineTest is Test {
    Machine public target;

    function setUp() public {
        target = new Machine();
    }

    /// @notice invariant 1: after spawn, send behaves correctly
    function test_invariant_1() public {
        bytes32 m = keccak256(abi.encodePacked("u-test-invariant-001"));

        // --- Setup ---
        // spawn(machine: m, widget: "dialog", context: "{}") -> ok
        // target.spawn(m, "dialog", "{}");
        // TODO: Assert ok variant

        // --- Assertions ---
        // send(machine: m, event: "{ \"type\": \"OPEN\" }") -> ok
        // target.send(m, "{ "type": "OPEN" }");
        // TODO: Assert ok variant
    }

}
