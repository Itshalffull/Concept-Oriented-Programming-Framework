// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LatticeMerge.sol";

contract LatticeMergeTest is Test {
    LatticeMerge public target;

    event MergeClean(bytes32 indexed resultHash);

    function setUp() public {
        target = new LatticeMerge();
    }

    // --- register tests ---

    function test_register_returns_metadata() public {
        (string memory name, string memory category, string[] memory contentTypes) = target.register();

        assertEq(name, "lattice");
        assertEq(category, "merge");
        assertEq(contentTypes.length, 1);
        assertEq(contentTypes[0], "application/crdt+json");
    }

    // --- execute tests ---

    function test_execute_identical_inputs() public {
        bytes memory content = "same";
        (bytes memory result, bool clean) = target.execute(content, content, content);

        assertTrue(clean);
        // Lattice always concatenates ours + theirs
        assertEq(result, abi.encodePacked(content, content));
    }

    function test_execute_different_inputs() public {
        bytes memory base = "base";
        bytes memory ours = "ours";
        bytes memory theirs = "theirs";

        (bytes memory result, bool clean) = target.execute(base, ours, theirs);

        assertTrue(clean);
        assertEq(result, abi.encodePacked(ours, theirs));
    }

    function test_execute_always_clean() public {
        bytes memory base = "x";
        bytes memory ours = "y";
        bytes memory theirs = "z";

        (, bool clean) = target.execute(base, ours, theirs);
        assertTrue(clean);
    }

    function test_execute_emits_clean_event() public {
        bytes memory base = "base";
        bytes memory ours = "ours";
        bytes memory theirs = "theirs";
        bytes memory expected = abi.encodePacked(ours, theirs);

        vm.expectEmit(true, false, false, false);
        emit MergeClean(keccak256(expected));

        target.execute(base, ours, theirs);
    }

    function test_execute_commutative_when_clean() public {
        bytes memory base = "base";
        bytes memory sideA = "alpha";
        bytes memory sideB = "beta";

        // Lattice merge produces ours+theirs, so order matters for the result bytes,
        // but both should be clean
        (, bool cleanAB) = target.execute(base, sideA, sideB);
        (, bool cleanBA) = target.execute(base, sideB, sideA);

        assertTrue(cleanAB);
        assertTrue(cleanBA);
    }

    function test_execute_empty_inputs() public {
        bytes memory empty = "";
        (bytes memory result, bool clean) = target.execute(empty, empty, empty);

        assertTrue(clean);
        assertEq(result.length, 0);
    }

    function test_execute_one_side_empty() public {
        bytes memory base = "base";
        bytes memory ours = "data";
        bytes memory theirs = "";

        (bytes memory result, bool clean) = target.execute(base, ours, theirs);

        assertTrue(clean);
        assertEq(result, abi.encodePacked(ours, theirs));
    }
}
