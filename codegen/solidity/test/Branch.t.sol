// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Branch.sol";

contract BranchTest is Test {
    Branch public target;

    event BranchCreated(bytes32 indexed branchId, string name, bytes32 fromNode);
    event BranchAdvanced(bytes32 indexed branchId, bytes32 newHead);
    event BranchDeleted(bytes32 indexed branchId);
    event BranchProtected(bytes32 indexed branchId);
    event UpstreamSet(bytes32 indexed branchId, bytes32 indexed upstreamId);
    event BranchArchived(bytes32 indexed branchId);

    function setUp() public {
        target = new Branch();
    }

    // --- create tests ---

    function test_create_stores_branch() public {
        bytes32 fromNode = keccak256("commit1");
        bytes32 branchId = target.create("main", fromNode);

        Branch.BranchInfo memory info = target.getBranch(branchId);
        assertEq(info.name, "main");
        assertEq(info.head, fromNode);
        assertFalse(info.isProtected);
        assertFalse(info.archived);
        assertTrue(info.exists);
    }

    function test_create_emits_event() public {
        bytes32 fromNode = keccak256("commit1");

        vm.expectEmit(false, false, false, true);
        emit BranchCreated(bytes32(0), "main", fromNode);

        target.create("main", fromNode);
    }

    function test_create_duplicate_name_reverts() public {
        bytes32 fromNode = keccak256("commit1");
        target.create("main", fromNode);

        vm.expectRevert("Branch name already exists");
        target.create("main", keccak256("commit2"));
    }

    // --- advance tests ---

    function test_advance_moves_head() public {
        bytes32 fromNode = keccak256("commit1");
        bytes32 branchId = target.create("feature", fromNode);

        bytes32 newNode = keccak256("commit2");
        target.advance(branchId, newNode);

        Branch.BranchInfo memory info = target.getBranch(branchId);
        assertEq(info.head, newNode);
    }

    function test_advance_emits_event() public {
        bytes32 fromNode = keccak256("commit1");
        bytes32 branchId = target.create("feature", fromNode);
        bytes32 newNode = keccak256("commit2");

        vm.expectEmit(true, false, false, true);
        emit BranchAdvanced(branchId, newNode);

        target.advance(branchId, newNode);
    }

    function test_advance_nonexistent_reverts() public {
        vm.expectRevert("Branch does not exist");
        target.advance(keccak256("fake"), keccak256("node"));
    }

    // --- protect tests ---

    function test_protect_prevents_advance() public {
        bytes32 branchId = target.create("main", keccak256("commit1"));
        target.protect(branchId);

        vm.expectRevert("Branch is protected");
        target.advance(branchId, keccak256("commit2"));
    }

    function test_protect_prevents_delete() public {
        bytes32 branchId = target.create("main", keccak256("commit1"));
        target.protect(branchId);

        vm.expectRevert("Branch is protected");
        target.deleteBranch(branchId);
    }

    function test_protect_emits_event() public {
        bytes32 branchId = target.create("main", keccak256("commit1"));

        vm.expectEmit(true, false, false, false);
        emit BranchProtected(branchId);

        target.protect(branchId);
    }

    // --- deleteBranch tests ---

    function test_delete_removes_branch() public {
        bytes32 branchId = target.create("feature", keccak256("commit1"));
        target.deleteBranch(branchId);

        vm.expectRevert("Branch does not exist");
        target.getBranch(branchId);
    }

    function test_delete_frees_name() public {
        bytes32 branchId = target.create("feature", keccak256("commit1"));
        target.deleteBranch(branchId);

        // Should be able to reuse the name
        target.create("feature", keccak256("commit2"));
    }

    function test_delete_emits_event() public {
        bytes32 branchId = target.create("feature", keccak256("commit1"));

        vm.expectEmit(true, false, false, false);
        emit BranchDeleted(branchId);

        target.deleteBranch(branchId);
    }

    // --- archive tests ---

    function test_archive_marks_archived() public {
        bytes32 branchId = target.create("old-feature", keccak256("commit1"));
        target.archive(branchId);

        Branch.BranchInfo memory info = target.getBranch(branchId);
        assertTrue(info.archived);
    }

    function test_archive_prevents_advance() public {
        bytes32 branchId = target.create("old-feature", keccak256("commit1"));
        target.archive(branchId);

        vm.expectRevert("Branch is archived");
        target.advance(branchId, keccak256("commit2"));
    }

    function test_archive_emits_event() public {
        bytes32 branchId = target.create("old-feature", keccak256("commit1"));

        vm.expectEmit(true, false, false, false);
        emit BranchArchived(branchId);

        target.archive(branchId);
    }

    // --- setUpstream tests ---

    function test_setUpstream_stores_upstream() public {
        bytes32 branchId = target.create("feature", keccak256("commit1"));
        bytes32 upstreamId = keccak256("upstream-main");
        target.setUpstream(branchId, upstreamId);

        Branch.BranchInfo memory info = target.getBranch(branchId);
        assertEq(info.upstream, upstreamId);
    }

    function test_setUpstream_emits_event() public {
        bytes32 branchId = target.create("feature", keccak256("commit1"));
        bytes32 upstreamId = keccak256("upstream-main");

        vm.expectEmit(true, true, false, false);
        emit UpstreamSet(branchId, upstreamId);

        target.setUpstream(branchId, upstreamId);
    }
}
