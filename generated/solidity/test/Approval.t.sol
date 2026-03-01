// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Approval.sol";

/// @title Approval Conformance Tests
/// @notice Tests for multi-party approval with configurable policy
contract ApprovalTest is Test {
    Approval public target;

    bytes32 constant APPROVAL_ID = keccak256("approval-001");
    bytes32 constant SUBJECT_REF = keccak256("pr-123");

    address constant APPROVER_1 = address(0x1001);
    address constant APPROVER_2 = address(0x1002);
    address constant APPROVER_3 = address(0x1003);
    address constant NON_APPROVER = address(0x9999);

    function setUp() public {
        target = new Approval();
    }

    function _createDefaultApproval() internal {
        address[] memory approvers = new address[](3);
        approvers[0] = APPROVER_1;
        approvers[1] = APPROVER_2;
        approvers[2] = APPROVER_3;

        target.request(APPROVAL_ID, SUBJECT_REF, 2, block.timestamp + 1 days, approvers);
    }

    /// @notice Creating an approval request sets Pending status
    function test_request_creates_pending() public {
        _createDefaultApproval();

        Approval.ApprovalView memory view = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(view.status), uint8(Approval.Status.Pending));
        assertEq(view.requiredApprovals, 2);
        assertEq(view.approveCount, 0);
    }

    /// @notice Duplicate approval request reverts
    function test_request_duplicate_reverts() public {
        _createDefaultApproval();

        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;

        vm.expectRevert("Approval: already exists");
        target.request(APPROVAL_ID, SUBJECT_REF, 1, block.timestamp + 1 days, approvers);
    }

    /// @notice Deadline in the past reverts
    function test_request_past_deadline_reverts() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;

        vm.expectRevert("Approval: deadline must be in future");
        target.request(APPROVAL_ID, SUBJECT_REF, 1, block.timestamp - 1, approvers);
    }

    /// @notice Not enough approvers for required count reverts
    function test_request_insufficient_approvers_reverts() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;

        vm.expectRevert("Approval: not enough approvers");
        target.request(APPROVAL_ID, SUBJECT_REF, 2, block.timestamp + 1 days, approvers);
    }

    /// @notice Approving reaches quorum and resolves to Approved
    function test_approve_reaches_quorum() public {
        _createDefaultApproval();

        vm.prank(APPROVER_1);
        target.approve(APPROVAL_ID);

        Approval.ApprovalView memory mid = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(mid.status), uint8(Approval.Status.Pending));
        assertEq(mid.approveCount, 1);

        vm.prank(APPROVER_2);
        target.approve(APPROVAL_ID);

        Approval.ApprovalView memory done = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(done.status), uint8(Approval.Status.Approved));
        assertEq(done.approveCount, 2);
    }

    /// @notice Non-approver cannot vote
    function test_approve_non_approver_reverts() public {
        _createDefaultApproval();

        vm.prank(NON_APPROVER);
        vm.expectRevert("Approval: not an authorized approver");
        target.approve(APPROVAL_ID);
    }

    /// @notice Double voting reverts
    function test_approve_double_vote_reverts() public {
        _createDefaultApproval();

        vm.prank(APPROVER_1);
        target.approve(APPROVAL_ID);

        vm.prank(APPROVER_1);
        vm.expectRevert("Approval: already voted");
        target.approve(APPROVAL_ID);
    }

    /// @notice Denying when quorum becomes impossible auto-denies
    function test_deny_auto_resolves() public {
        _createDefaultApproval();

        // With 3 approvers and 2 required: 2 denials make it impossible
        vm.prank(APPROVER_1);
        target.deny(APPROVAL_ID);

        Approval.ApprovalView memory mid = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(mid.status), uint8(Approval.Status.Pending));

        vm.prank(APPROVER_2);
        target.deny(APPROVAL_ID);

        Approval.ApprovalView memory done = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(done.status), uint8(Approval.Status.Denied));
    }

    /// @notice Requesting changes sets ChangesRequested
    function test_requestChanges() public {
        _createDefaultApproval();

        vm.prank(APPROVER_1);
        target.requestChanges(APPROVAL_ID);

        Approval.ApprovalView memory view = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(view.status), uint8(Approval.Status.ChangesRequested));
        assertEq(view.changesCount, 1);
    }

    /// @notice Timeout after deadline sets TimedOut
    function test_timeout_after_deadline() public {
        _createDefaultApproval();

        // Warp past deadline
        vm.warp(block.timestamp + 2 days);

        target.timeout(APPROVAL_ID);

        Approval.ApprovalView memory view = target.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(view.status), uint8(Approval.Status.TimedOut));
    }

    /// @notice Timeout before deadline reverts
    function test_timeout_before_deadline_reverts() public {
        _createDefaultApproval();

        vm.expectRevert("Approval: deadline not yet reached");
        target.timeout(APPROVAL_ID);
    }

    /// @notice Cannot vote on a resolved approval
    function test_vote_on_resolved_reverts() public {
        _createDefaultApproval();

        vm.prank(APPROVER_1);
        target.approve(APPROVAL_ID);
        vm.prank(APPROVER_2);
        target.approve(APPROVAL_ID);

        vm.prank(APPROVER_3);
        vm.expectRevert("Approval: not in Pending status");
        target.approve(APPROVAL_ID);
    }

    /// @notice Getting a non-existent approval reverts
    function test_getApprovalStatus_nonexistent_reverts() public {
        vm.expectRevert("Approval: not found");
        target.getApprovalStatus(keccak256("nonexistent"));
    }

    /// @notice Request emits event
    function test_request_emits_event() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;

        vm.expectEmit(true, true, false, true);
        emit Approval.RequestCompleted(APPROVAL_ID, SUBJECT_REF, address(this), 1);

        target.request(APPROVAL_ID, SUBJECT_REF, 1, block.timestamp + 1 days, approvers);
    }

    /// @notice totalVotes is tracked correctly
    function test_total_votes_tracking() public {
        _createDefaultApproval();

        vm.prank(APPROVER_1);
        target.approve(APPROVAL_ID);

        vm.prank(APPROVER_2);
        target.deny(APPROVAL_ID);

        Approval.ApprovalView memory view = target.getApprovalStatus(APPROVAL_ID);
        assertEq(view.totalVotes, 2);
        assertEq(view.approveCount, 1);
        assertEq(view.denyCount, 1);
    }
}
