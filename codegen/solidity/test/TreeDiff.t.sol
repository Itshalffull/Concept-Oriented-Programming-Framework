// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TreeDiff.sol";

contract TreeDiffTest is Test {
    TreeDiff public target;

    event Computed(bytes32 indexed hashA, bytes32 indexed hashB, uint256 distance);

    function setUp() public {
        target = new TreeDiff();
    }

    // --- register tests ---

    function test_register_returns_metadata() public {
        (string memory name, string memory category, string[] memory contentTypes) = target.register();

        assertEq(name, "tree");
        assertEq(category, "diff");
        assertEq(contentTypes.length, 3);
        assertEq(contentTypes[0], "application/json");
        assertEq(contentTypes[1], "application/xml");
        assertEq(contentTypes[2], "text/xml");
    }

    // --- compute tests ---

    function test_compute_identical_content() public {
        bytes memory content = '{"key":"value"}';
        (bytes memory editScript, uint256 distance) = target.compute(content, content);

        assertEq(distance, 0);
        assertEq(editScript.length, 0);
    }

    function test_compute_different_content() public {
        bytes memory contentA = '{"a":1}';
        bytes memory contentB = '{"a":1,"b":2}';

        (bytes memory editScript, uint256 distance) = target.compute(contentA, contentB);

        assertEq(distance, 6); // abs(7 - 13)
        assertEq(editScript.length, 64);
    }

    function test_compute_different_same_length() public {
        bytes memory contentA = '{"a":1}';
        bytes memory contentB = '{"b":2}';

        (bytes memory editScript, uint256 distance) = target.compute(contentA, contentB);

        assertEq(distance, 0);
        assertTrue(editScript.length > 0);
    }

    function test_compute_emits_event_on_difference() public {
        bytes memory contentA = "<root/>";
        bytes memory contentB = "<root><child/></root>";
        bytes32 hashA = keccak256(contentA);
        bytes32 hashB = keccak256(contentB);

        vm.expectEmit(true, true, false, true);
        emit Computed(hashA, hashB, 14); // abs(7 - 21)

        target.compute(contentA, contentB);
    }

    function test_compute_no_event_on_identical() public {
        bytes memory content = "<root/>";
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
        bytes memory contentA = '{"data":true}';
        bytes memory contentB = "";

        (bytes memory editScript, uint256 distance) = target.compute(contentA, contentB);

        assertEq(distance, 13);
        assertEq(editScript.length, 64);
    }
}
