// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Version.sol";

contract VersionTest is Test {
    Version public target;

    event Snapshot(bytes32 indexed entityId, bytes32 indexed versionId);
    event Rollback(bytes32 indexed entityId, bytes32 indexed versionId);

    function setUp() public {
        target = new Version();
    }

    // --- snapshot tests ---

    function test_snapshot_stores_version() public {
        bytes32 eid = keccak256("entity1");
        bytes32 vid = keccak256("v1");
        bytes32 author = keccak256("alice");
        target.snapshot(eid, vid, '{"title":"Hello"}', author);

        Version.VersionEntry memory v = target.getVersion(eid, vid);
        assertEq(v.snapshotData, '{"title":"Hello"}');
        assertEq(v.author, author);
        assertTrue(v.exists);
    }

    function test_snapshot_emits_event() public {
        bytes32 eid = keccak256("entity1");
        bytes32 vid = keccak256("v1");

        vm.expectEmit(true, true, false, false);
        emit Snapshot(eid, vid);

        target.snapshot(eid, vid, "data", keccak256("alice"));
    }

    function test_snapshot_duplicate_version_reverts() public {
        bytes32 eid = keccak256("entity1");
        bytes32 vid = keccak256("v1");
        target.snapshot(eid, vid, "data", keccak256("alice"));

        vm.expectRevert("Version already exists");
        target.snapshot(eid, vid, "other", keccak256("bob"));
    }

    // --- getVersion tests ---

    function test_getVersion_nonexistent_reverts() public {
        vm.expectRevert("Version does not exist");
        target.getVersion(keccak256("e"), keccak256("v"));
    }

    // --- getVersionCount tests ---

    function test_getVersionCount_starts_at_zero() public {
        assertEq(target.getVersionCount(keccak256("entity1")), 0);
    }

    function test_getVersionCount_increments() public {
        bytes32 eid = keccak256("entity1");
        target.snapshot(eid, keccak256("v1"), "d1", keccak256("a"));
        target.snapshot(eid, keccak256("v2"), "d2", keccak256("a"));

        assertEq(target.getVersionCount(eid), 2);
    }

    // --- getVersionList tests ---

    function test_getVersionList_returns_ordered_ids() public {
        bytes32 eid = keccak256("entity1");
        bytes32 v1 = keccak256("v1");
        bytes32 v2 = keccak256("v2");
        target.snapshot(eid, v1, "d1", keccak256("a"));
        target.snapshot(eid, v2, "d2", keccak256("a"));

        bytes32[] memory list = target.getVersionList(eid);
        assertEq(list.length, 2);
        assertEq(list[0], v1);
        assertEq(list[1], v2);
    }

    function test_getVersionList_empty_for_unknown_entity() public {
        bytes32[] memory list = target.getVersionList(keccak256("unknown"));
        assertEq(list.length, 0);
    }

    // --- rollback tests ---

    function test_rollback_emits_event() public {
        bytes32 eid = keccak256("entity1");
        bytes32 vid = keccak256("v1");
        target.snapshot(eid, vid, "data", keccak256("alice"));

        vm.expectEmit(true, true, false, false);
        emit Rollback(eid, vid);

        target.rollback(eid, vid);
    }

    function test_rollback_nonexistent_version_reverts() public {
        vm.expectRevert("Version does not exist");
        target.rollback(keccak256("e"), keccak256("v"));
    }
}
