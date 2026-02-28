// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PatienceDiff.sol";

contract PatienceDiffTest is Test {
    PatienceDiff public target;

    event Computed(bytes32 indexed hashA, bytes32 indexed hashB, uint256 distance);

    function setUp() public {
        target = new PatienceDiff();
    }

    // --- register tests ---

    function test_register_returns_metadata() public {
        (string memory name, string memory category, string[] memory contentTypes) = target.register();

        assertEq(name, "patience");
        assertEq(category, "diff");
        assertEq(contentTypes.length, 2);
        assertEq(contentTypes[0], "text/plain");
        assertEq(contentTypes[1], "text/*");
    }

    // --- compute tests ---

    function test_compute_identical_content() public {
        bytes memory content = "hello world";
        (bytes memory editScript, uint256 distance) = target.compute(content, content);

        assertEq(distance, 0);
        assertEq(editScript.length, 0);
    }

    function test_compute_different_content() public {
        bytes memory contentA = "hello";
        bytes memory contentB = "hello world";

        (bytes memory editScript, uint256 distance) = target.compute(contentA, contentB);

        assertEq(distance, 6); // abs(5 - 11)
        assertEq(editScript.length, 64);
    }

    function test_compute_different_same_length() public {
        bytes memory contentA = "abcd";
        bytes memory contentB = "wxyz";

        (bytes memory editScript, uint256 distance) = target.compute(contentA, contentB);

        assertEq(distance, 0);
        assertTrue(editScript.length > 0);
    }

    function test_compute_emits_event_on_difference() public {
        bytes memory contentA = "alpha";
        bytes memory contentB = "beta";
        bytes32 hashA = keccak256(contentA);
        bytes32 hashB = keccak256(contentB);

        vm.expectEmit(true, true, false, true);
        emit Computed(hashA, hashB, 1); // abs(5 - 4)

        target.compute(contentA, contentB);
    }

    function test_compute_no_event_on_identical() public {
        bytes memory content = "same";
        (bytes memory editScript, uint256 distance) = target.compute(content, content);
        assertEq(distance, 0);
        assertEq(editScript.length, 0);
    }

    function test_compute_empty_inputs() public {
        bytes memory empty = "";
        (bytes memory editScript, uint256 distance) = target.compute(empty, empty);

        assertEq(distance, 0);
        assertEq(editScript.length, 0);
    }

    function test_compute_one_empty() public {
        bytes memory contentA = "content";
        bytes memory contentB = "";

        (bytes memory editScript, uint256 distance) = target.compute(contentA, contentB);

        assertEq(distance, 7);
        assertEq(editScript.length, 64);
    }
}
