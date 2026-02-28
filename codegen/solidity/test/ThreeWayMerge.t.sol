// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ThreeWayMerge.sol";

contract ThreeWayMergeTest is Test {
    ThreeWayMerge public target;

    event MergeClean(bytes32 indexed resultHash);
    event MergeConflicts(uint256 conflictCount);

    function setUp() public {
        target = new ThreeWayMerge();
    }

    // --- register tests ---

    function test_register_returns_metadata() public {
        (string memory name, string memory category, string[] memory contentTypes) = target.register();

        assertEq(name, "three-way");
        assertEq(category, "merge");
        assertEq(contentTypes.length, 2);
        assertEq(contentTypes[0], "text/plain");
        assertEq(contentTypes[1], "text/*");
    }

    // --- execute tests ---

    function test_execute_identical_inputs() public {
        bytes memory content = "same content";
        (bytes memory result, bool clean) = target.execute(content, content, content);

        assertTrue(clean);
        assertEq(result, content);
    }

    function test_execute_ours_equals_base() public {
        bytes memory base = "original";
        bytes memory ours = "original";
        bytes memory theirs = "modified";

        (bytes memory result, bool clean) = target.execute(base, ours, theirs);

        assertTrue(clean);
        assertEq(result, theirs);
    }

    function test_execute_theirs_equals_base() public {
        bytes memory base = "original";
        bytes memory ours = "modified";
        bytes memory theirs = "original";

        (bytes memory result, bool clean) = target.execute(base, ours, theirs);

        assertTrue(clean);
        assertEq(result, ours);
    }

    function test_execute_ours_equals_theirs() public {
        bytes memory base = "original";
        bytes memory ours = "same change";
        bytes memory theirs = "same change";

        (bytes memory result, bool clean) = target.execute(base, ours, theirs);

        assertTrue(clean);
        assertEq(result, ours);
    }

    function test_execute_conflict_reverts() public {
        bytes memory base = "original";
        bytes memory ours = "change A";
        bytes memory theirs = "change B";

        vm.expectRevert("Merge conflicts detected");
        target.execute(base, ours, theirs);
    }

    function test_execute_emits_clean_event_ours_equals_base() public {
        bytes memory base = "base";
        bytes memory theirs = "theirs";

        vm.expectEmit(true, false, false, false);
        emit MergeClean(keccak256(theirs));

        target.execute(base, base, theirs);
    }

    function test_execute_emits_clean_event_theirs_equals_base() public {
        bytes memory base = "base";
        bytes memory ours = "ours";

        vm.expectEmit(true, false, false, false);
        emit MergeClean(keccak256(ours));

        target.execute(base, ours, base);
    }

    function test_execute_commutative_when_clean() public {
        bytes memory base = "original";
        bytes memory sideA = "original"; // unchanged
        bytes memory sideB = "modified";

        (bytes memory resultAB, bool cleanAB) = target.execute(base, sideA, sideB);
        (bytes memory resultBA, bool cleanBA) = target.execute(base, sideB, sideA);

        assertTrue(cleanAB);
        assertTrue(cleanBA);
        assertEq(resultAB, resultBA);
    }

    function test_execute_empty_base_both_changed() public {
        bytes memory base = "";
        bytes memory ours = "added A";
        bytes memory theirs = "added B";

        vm.expectRevert("Merge conflicts detected");
        target.execute(base, ours, theirs);
    }
}
