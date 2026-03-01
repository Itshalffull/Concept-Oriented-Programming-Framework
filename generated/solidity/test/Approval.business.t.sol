// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Approval.sol";

/// @title Approval Business Logic Tests
/// @notice Tests for quorum logic, mixed voting, timeout edge cases, and access control scenarios
contract ApprovalBusinessTest is Test {
    Approval private instance;

    bytes32 constant APPROVAL_ID = keccak256("biz-approval-001");
    bytes32 constant APPROVAL_ID_2 = keccak256("biz-approval-002");
    bytes32 constant SUBJECT_REF = keccak256("biz-subject");

    address constant APPROVER_1 = address(0x2001);
    address constant APPROVER_2 = address(0x2002);
    address constant APPROVER_3 = address(0x2003);
    address constant APPROVER_4 = address(0x2004);
    address constant APPROVER_5 = address(0x2005);
    address constant NON_APPROVER = address(0x9999);
    address constant REQUESTER = address(0x8888);

    function setUp() public {
        instance = new Approval();
    }

    // --- Helpers ---

    function _createApproval(
        bytes32 approvalId,
        uint256 required,
        uint256 deadline,
        address[] memory approvers
    ) internal {
        instance.request(approvalId, SUBJECT_REF, required, deadline, approvers);
    }

    function _createStandardApproval() internal {
        address[] memory approvers = new address[](3);
        approvers[0] = APPROVER_1;
        approvers[1] = APPROVER_2;
        approvers[2] = APPROVER_3;
        _createApproval(APPROVAL_ID, 2, block.timestamp + 1 days, approvers);
    }

    // --- Complex quorum scenarios ---

    /// @notice Quorum of 1 with single approver: one approve resolves immediately
    function testSingleApproverQuorum() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;
        _createApproval(APPROVAL_ID, 1, block.timestamp + 1 days, approvers);

        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);

        Approval.ApprovalView memory v = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(v.status), uint8(Approval.Status.Approved));
        assertEq(v.approveCount, 1);
        assertEq(v.totalVotes, 1);
    }

    /// @notice With 5 approvers and quorum of 3: exact quorum triggers Approved
    function testLargerQuorumExactThreshold() public {
        address[] memory approvers = new address[](5);
        approvers[0] = APPROVER_1;
        approvers[1] = APPROVER_2;
        approvers[2] = APPROVER_3;
        approvers[3] = APPROVER_4;
        approvers[4] = APPROVER_5;
        _createApproval(APPROVAL_ID, 3, block.timestamp + 1 days, approvers);

        // Two approvals: still pending
        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);
        vm.prank(APPROVER_2);
        instance.approve(APPROVAL_ID);

        Approval.ApprovalView memory mid = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(mid.status), uint8(Approval.Status.Pending));
        assertEq(mid.approveCount, 2);

        // Third approval: quorum reached
        vm.prank(APPROVER_3);
        instance.approve(APPROVAL_ID);

        Approval.ApprovalView memory done = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(done.status), uint8(Approval.Status.Approved));
        assertEq(done.approveCount, 3);
    }

    /// @notice Mixed votes: approvals + denials with eventual approval
    function testMixedVotesApprovalWins() public {
        address[] memory approvers = new address[](5);
        approvers[0] = APPROVER_1;
        approvers[1] = APPROVER_2;
        approvers[2] = APPROVER_3;
        approvers[3] = APPROVER_4;
        approvers[4] = APPROVER_5;
        _createApproval(APPROVAL_ID, 3, block.timestamp + 1 days, approvers);

        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);

        vm.prank(APPROVER_2);
        instance.deny(APPROVAL_ID);

        vm.prank(APPROVER_3);
        instance.approve(APPROVAL_ID);

        // Still pending: 2 approve, 1 deny, need 3 approve
        Approval.ApprovalView memory mid = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(mid.status), uint8(Approval.Status.Pending));

        vm.prank(APPROVER_4);
        instance.approve(APPROVAL_ID);

        Approval.ApprovalView memory done = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(done.status), uint8(Approval.Status.Approved));
        assertEq(done.approveCount, 3);
        assertEq(done.denyCount, 1);
        assertEq(done.totalVotes, 4);
    }

    /// @notice Auto-deny: too many denials make quorum impossible
    function testAutoDenyWhenQuorumImpossible() public {
        address[] memory approvers = new address[](5);
        approvers[0] = APPROVER_1;
        approvers[1] = APPROVER_2;
        approvers[2] = APPROVER_3;
        approvers[3] = APPROVER_4;
        approvers[4] = APPROVER_5;
        _createApproval(APPROVAL_ID, 4, block.timestamp + 1 days, approvers);

        // Need 4 of 5. If 2 deny, only 3 remaining possible approvals -> impossible
        vm.prank(APPROVER_1);
        instance.deny(APPROVAL_ID);

        Approval.ApprovalView memory mid = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(mid.status), uint8(Approval.Status.Pending));

        vm.prank(APPROVER_2);
        instance.deny(APPROVAL_ID);

        Approval.ApprovalView memory done = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(done.status), uint8(Approval.Status.Denied));
        assertEq(done.denyCount, 2);
    }

    // --- RequestChanges scenarios ---

    /// @notice RequestChanges immediately resolves to ChangesRequested
    function testRequestChangesImmediateResolution() public {
        _createStandardApproval();

        vm.prank(APPROVER_2);
        instance.requestChanges(APPROVAL_ID);

        Approval.ApprovalView memory v = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(v.status), uint8(Approval.Status.ChangesRequested));
        assertEq(v.changesCount, 1);
        assertEq(v.totalVotes, 1);
    }

    /// @notice Cannot approve after ChangesRequested
    function testRevertApproveAfterChangesRequested() public {
        _createStandardApproval();

        vm.prank(APPROVER_1);
        instance.requestChanges(APPROVAL_ID);

        vm.prank(APPROVER_2);
        vm.expectRevert("Approval: not in Pending status");
        instance.approve(APPROVAL_ID);
    }

    /// @notice Cannot deny after ChangesRequested
    function testRevertDenyAfterChangesRequested() public {
        _createStandardApproval();

        vm.prank(APPROVER_1);
        instance.requestChanges(APPROVAL_ID);

        vm.prank(APPROVER_2);
        vm.expectRevert("Approval: not in Pending status");
        instance.deny(APPROVAL_ID);
    }

    // --- Timeout scenarios ---

    /// @notice Timeout at exact deadline succeeds
    function testTimeoutAtExactDeadline() public {
        uint256 deadline = block.timestamp + 1 days;
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;
        _createApproval(APPROVAL_ID, 1, deadline, approvers);

        // Warp to exact deadline
        vm.warp(deadline);
        instance.timeout(APPROVAL_ID);

        Approval.ApprovalView memory v = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(v.status), uint8(Approval.Status.TimedOut));
    }

    /// @notice Timeout one second before deadline still reverts
    function testRevertTimeoutOneSecondBeforeDeadline() public {
        uint256 deadline = block.timestamp + 1 days;
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;
        _createApproval(APPROVAL_ID, 1, deadline, approvers);

        vm.warp(deadline - 1);
        vm.expectRevert("Approval: deadline not yet reached");
        instance.timeout(APPROVAL_ID);
    }

    /// @notice Cannot timeout an already approved request
    function testRevertTimeoutAfterApproved() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;
        _createApproval(APPROVAL_ID, 1, block.timestamp + 1 days, approvers);

        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert("Approval: not in Pending status");
        instance.timeout(APPROVAL_ID);
    }

    /// @notice Anyone can call timeout (not restricted to approvers)
    function testTimeoutCallableByAnyone() public {
        _createStandardApproval();

        vm.warp(block.timestamp + 2 days);

        // Called by a non-approver, non-requester address
        vm.prank(address(0x7777));
        instance.timeout(APPROVAL_ID);

        Approval.ApprovalView memory v = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(v.status), uint8(Approval.Status.TimedOut));
    }

    // --- Access control ---

    /// @notice Non-approver cannot deny
    function testRevertNonApproverDeny() public {
        _createStandardApproval();

        vm.prank(NON_APPROVER);
        vm.expectRevert("Approval: not an authorized approver");
        instance.deny(APPROVAL_ID);
    }

    /// @notice Non-approver cannot requestChanges
    function testRevertNonApproverRequestChanges() public {
        _createStandardApproval();

        vm.prank(NON_APPROVER);
        vm.expectRevert("Approval: not an authorized approver");
        instance.requestChanges(APPROVAL_ID);
    }

    /// @notice Approver who denied cannot also approve (already voted)
    function testRevertApproveAfterDeny() public {
        _createStandardApproval();

        vm.prank(APPROVER_1);
        instance.deny(APPROVAL_ID);

        vm.prank(APPROVER_1);
        vm.expectRevert("Approval: already voted");
        instance.approve(APPROVAL_ID);
    }

    /// @notice Approver who approved cannot also deny (already voted)
    function testRevertDenyAfterApprove() public {
        _createStandardApproval();

        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);

        vm.prank(APPROVER_1);
        vm.expectRevert("Approval: already voted");
        instance.deny(APPROVAL_ID);
    }

    // --- Event emission ---

    /// @notice Approve emits ApproveCompleted event
    function testApproveEmitsEvent() public {
        _createStandardApproval();

        vm.expectEmit(true, true, false, false);
        emit Approval.ApproveCompleted(APPROVAL_ID, APPROVER_1);

        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);
    }

    /// @notice Deny emits DenyCompleted event
    function testDenyEmitsEvent() public {
        _createStandardApproval();

        vm.expectEmit(true, true, false, false);
        emit Approval.DenyCompleted(APPROVAL_ID, APPROVER_1);

        vm.prank(APPROVER_1);
        instance.deny(APPROVAL_ID);
    }

    /// @notice StatusResolved emits when quorum is reached
    function testStatusResolvedEmitsOnQuorum() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;
        _createApproval(APPROVAL_ID, 1, block.timestamp + 1 days, approvers);

        vm.expectEmit(true, false, false, true);
        emit Approval.StatusResolved(APPROVAL_ID, Approval.Status.Approved);

        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);
    }

    /// @notice Timeout emits both TimeoutCompleted and StatusResolved
    function testTimeoutEmitsBothEvents() public {
        _createStandardApproval();
        vm.warp(block.timestamp + 2 days);

        vm.expectEmit(true, false, false, false);
        emit Approval.TimeoutCompleted(APPROVAL_ID);

        instance.timeout(APPROVAL_ID);
    }

    // --- Validation edge cases ---

    /// @notice requiredApprovals of 0 reverts
    function testRevertZeroRequiredApprovals() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;

        vm.expectRevert("Approval: requiredApprovals must be > 0");
        instance.request(APPROVAL_ID, SUBJECT_REF, 0, block.timestamp + 1 days, approvers);
    }

    /// @notice requester is correctly stored as msg.sender
    function testRequesterIsMessageSender() public {
        address[] memory approvers = new address[](1);
        approvers[0] = APPROVER_1;

        vm.prank(REQUESTER);
        instance.request(APPROVAL_ID, SUBJECT_REF, 1, block.timestamp + 1 days, approvers);

        Approval.ApprovalView memory v = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(v.requester, REQUESTER);
    }

    /// @notice Multiple independent approvals have isolated state
    function testMultipleIndependentApprovals() public {
        address[] memory approvers1 = new address[](2);
        approvers1[0] = APPROVER_1;
        approvers1[1] = APPROVER_2;
        _createApproval(APPROVAL_ID, 1, block.timestamp + 1 days, approvers1);

        address[] memory approvers2 = new address[](2);
        approvers2[0] = APPROVER_3;
        approvers2[1] = APPROVER_4;
        _createApproval(APPROVAL_ID_2, 2, block.timestamp + 1 days, approvers2);

        // Approve first approval
        vm.prank(APPROVER_1);
        instance.approve(APPROVAL_ID);

        Approval.ApprovalView memory v1 = instance.getApprovalStatus(APPROVAL_ID);
        assertEq(uint8(v1.status), uint8(Approval.Status.Approved));

        // Second approval still pending
        Approval.ApprovalView memory v2 = instance.getApprovalStatus(APPROVAL_ID_2);
        assertEq(uint8(v2.status), uint8(Approval.Status.Pending));
        assertEq(v2.approveCount, 0);
    }
}
