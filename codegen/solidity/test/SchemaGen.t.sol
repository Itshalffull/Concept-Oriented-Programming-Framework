// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SchemaGen.sol";

/// @title SchemaGen Conformance Tests
/// @notice Generated from concept invariants
contract SchemaGenTest is Test {
    SchemaGen public target;

    function setUp() public {
        target = new SchemaGen();
    }

    /// @notice invariant 1: after generate, generate behaves correctly
    function test_invariant_1() public {
        bytes32 m = keccak256(abi.encodePacked("u-test-invariant-001"));
        bytes32 e = keccak256(abi.encodePacked("u-test-invariant-002"));

        // --- Setup ---
        // generate(spec: "s1", ast: { name: "Ping", typeParams: ["T"], purpose: "A test.", state: [], actions: [{ name: "ping", params: [], variants: [{ name: "ok", params: [], description: "Pong." }] }], invariants: [], capabilities: [] }) -> ok
        // target.generate("s1", /* struct { name: "Ping", typeParams: /* ["T"] */, purpose: "A test.", state: /* [] */, actions: /* [/* struct { name: "ping", params: /* [] */, variants: /* [/* struct { name: "ok", params: /* [] */, description: "Pong." } */] */ } */] */, invariants: /* [] */, capabilities: /* [] */ } */);
        // TODO: Assert ok variant

        // --- Assertions ---
        // generate(spec: "s2", ast: { name: "" }) -> error
        // target.generate("s2", /* struct { name: "" } */);
        // TODO: Assert error variant
    }

}
