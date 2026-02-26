// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Backlink.sol";

contract BacklinkTest is Test {
    Backlink public target;

    event Indexed(bytes32 indexed targetId, bytes32 sourceId);
    event Removed(bytes32 indexed targetId, bytes32 sourceId);

    function setUp() public {
        target = new Backlink();
    }

    // --- index tests ---

    function test_index_adds_backlink() public {
        bytes32 dest = keccak256("article");
        bytes32 source = keccak256("note");

        target.index(dest, source);

        bytes32[] memory backlinks = target.getBacklinks(dest);
        assertEq(backlinks.length, 1);
        assertEq(backlinks[0], source);
    }

    function test_index_emits_event() public {
        bytes32 dest = keccak256("article");
        bytes32 source = keccak256("note");

        vm.expectEmit(true, false, false, true);
        emit Indexed(dest, source);

        target.index(dest, source);
    }

    function test_index_zero_target_reverts() public {
        vm.expectRevert("Target ID cannot be zero");
        target.index(bytes32(0), keccak256("source"));
    }

    function test_index_zero_source_reverts() public {
        vm.expectRevert("Source ID cannot be zero");
        target.index(keccak256("target"), bytes32(0));
    }

    function test_index_duplicate_reverts() public {
        bytes32 dest = keccak256("article");
        bytes32 source = keccak256("note");

        target.index(dest, source);

        vm.expectRevert("Backlink already indexed");
        target.index(dest, source);
    }

    // --- remove tests ---

    function test_remove_deletes_backlink() public {
        bytes32 dest = keccak256("article");
        bytes32 source = keccak256("note");

        target.index(dest, source);
        target.remove(dest, source);

        assertEq(target.count(dest), 0);
    }

    function test_remove_emits_event() public {
        bytes32 dest = keccak256("article");
        bytes32 source = keccak256("note");

        target.index(dest, source);

        vm.expectEmit(true, false, false, true);
        emit Removed(dest, source);

        target.remove(dest, source);
    }

    function test_remove_nonexistent_reverts() public {
        vm.expectRevert("Backlink not found");
        target.remove(keccak256("target"), keccak256("source"));
    }

    // --- getBacklinks tests ---

    function test_getBacklinks_multiple() public {
        bytes32 dest = keccak256("article");
        bytes32 s1 = keccak256("note1");
        bytes32 s2 = keccak256("note2");

        target.index(dest, s1);
        target.index(dest, s2);

        bytes32[] memory backlinks = target.getBacklinks(dest);
        assertEq(backlinks.length, 2);
    }

    function test_getBacklinks_empty() public {
        bytes32[] memory backlinks = target.getBacklinks(keccak256("empty"));
        assertEq(backlinks.length, 0);
    }

    // --- count tests ---

    function test_count_tracks_additions() public {
        bytes32 dest = keccak256("article");

        assertEq(target.count(dest), 0);

        target.index(dest, keccak256("s1"));
        assertEq(target.count(dest), 1);

        target.index(dest, keccak256("s2"));
        assertEq(target.count(dest), 2);
    }
}
