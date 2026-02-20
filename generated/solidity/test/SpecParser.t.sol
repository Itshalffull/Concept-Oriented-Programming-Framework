// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SpecParser.sol";

/// @title SpecParser Conformance Tests
/// @notice Generated from concept invariants
contract SpecParserTest is Test {
    SpecParser public target;

    function setUp() public {
        target = new SpecParser();
    }

    /// @notice invariant 1: after parse, parse behaves correctly
    function test_invariant_1() public {
        bytes32 s = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 a = keccak256(abi.encodePacked("u-test-invariant-002"));
        bytes32 m = keccak256(abi.encodePacked("u-test-invariant-003"));

        // --- Setup ---
        // parse(source: "concept Tiny [X] { purpose { A test. } state { items: set X } actions { action get(x: X) { -> ok(item: X) { Return. } } } }") -> ok
        // target.parse("concept Tiny [X] { purpose { A test. } state { items: set X } actions { action get(x: X) { -> ok(item: X) { Return. } } } }");
        // TODO: Assert ok variant

        // --- Assertions ---
        // parse(source: "") -> error
        // target.parse("");
        // TODO: Assert error variant
    }

}
