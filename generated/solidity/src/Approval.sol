// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Approval
/// @notice Multi-party approval with configurable policy (quorum-based).
/// @dev Supports request, approve, deny, requestChanges, and timeout actions.

contract Approval {

    // --- Types ---

    enum Status { Pending, Approved, Denied, ChangesRequested, TimedOut }

    enum VoteType { None, Approve, Deny, RequestChanges }

    struct ApprovalData {
        bytes32 approvalId;
        bytes32 subjectRef;
        address requester;
        uint256 requiredApprovals;
        uint256 deadline;
        Status status;
        address[] approvers;
        uint256 approveCount;
        uint256 denyCount;
        uint256 changesCount;
        bool exists;
    }

    struct ApprovalView {
        bytes32 approvalId;
        bytes32 subjectRef;
        address requester;
        uint256 requiredApprovals;
        uint256 deadline;
        Status status;
        uint256 approveCount;
        uint256 denyCount;
        uint256 changesCount;
        uint256 totalVotes;
    }

    // --- Storage ---

    mapping(bytes32 => ApprovalData) private approvals;
    mapping(bytes32 => mapping(address => VoteType)) private votes;

    // --- Events ---

    event RequestCompleted(bytes32 indexed approvalId, bytes32 indexed subjectRef, address requester, uint256 requiredApprovals);
    event ApproveCompleted(bytes32 indexed approvalId, address indexed approver);
    event DenyCompleted(bytes32 indexed approvalId, address indexed denier);
    event RequestChangesCompleted(bytes32 indexed approvalId, address indexed reviewer);
    event TimeoutCompleted(bytes32 indexed approvalId);
    event StatusResolved(bytes32 indexed approvalId, Status status);

    // --- Actions ---

    /// @notice Request a new approval
    function request(
        bytes32 approvalId,
        bytes32 subjectRef,
        uint256 requiredApprovals,
        uint256 deadline,
        address[] calldata approvers
    ) external {
        require(!approvals[approvalId].exists, "Approval: already exists");
        require(requiredApprovals > 0, "Approval: requiredApprovals must be > 0");
        require(approvers.length >= requiredApprovals, "Approval: not enough approvers");
        require(deadline > block.timestamp, "Approval: deadline must be in future");

        ApprovalData storage approval = approvals[approvalId];
        approval.approvalId = approvalId;
        approval.subjectRef = subjectRef;
        approval.requester = msg.sender;
        approval.requiredApprovals = requiredApprovals;
        approval.deadline = deadline;
        approval.status = Status.Pending;
        approval.exists = true;

        for (uint256 i = 0; i < approvers.length; i++) {
            approval.approvers.push(approvers[i]);
        }

        emit RequestCompleted(approvalId, subjectRef, msg.sender, requiredApprovals);
    }

    /// @notice Approve the request
    function approve(bytes32 approvalId) external {
        ApprovalData storage approval = approvals[approvalId];
        require(approval.exists, "Approval: not found");
        require(approval.status == Status.Pending, "Approval: not in Pending status");
        require(_isApprover(approval, msg.sender), "Approval: not an authorized approver");
        require(votes[approvalId][msg.sender] == VoteType.None, "Approval: already voted");

        votes[approvalId][msg.sender] = VoteType.Approve;
        approval.approveCount++;

        emit ApproveCompleted(approvalId, msg.sender);

        // Check if quorum reached
        if (approval.approveCount >= approval.requiredApprovals) {
            approval.status = Status.Approved;
            emit StatusResolved(approvalId, Status.Approved);
        }
    }

    /// @notice Deny the request
    function deny(bytes32 approvalId) external {
        ApprovalData storage approval = approvals[approvalId];
        require(approval.exists, "Approval: not found");
        require(approval.status == Status.Pending, "Approval: not in Pending status");
        require(_isApprover(approval, msg.sender), "Approval: not an authorized approver");
        require(votes[approvalId][msg.sender] == VoteType.None, "Approval: already voted");

        votes[approvalId][msg.sender] = VoteType.Deny;
        approval.denyCount++;

        emit DenyCompleted(approvalId, msg.sender);

        // If denials make it impossible to reach quorum, auto-deny
        uint256 remainingVotes = approval.approvers.length - (approval.approveCount + approval.denyCount + approval.changesCount);
        if (approval.approveCount + remainingVotes < approval.requiredApprovals) {
            approval.status = Status.Denied;
            emit StatusResolved(approvalId, Status.Denied);
        }
    }

    /// @notice Request changes on the approval subject
    function requestChanges(bytes32 approvalId) external {
        ApprovalData storage approval = approvals[approvalId];
        require(approval.exists, "Approval: not found");
        require(approval.status == Status.Pending, "Approval: not in Pending status");
        require(_isApprover(approval, msg.sender), "Approval: not an authorized approver");
        require(votes[approvalId][msg.sender] == VoteType.None, "Approval: already voted");

        votes[approvalId][msg.sender] = VoteType.RequestChanges;
        approval.changesCount++;

        approval.status = Status.ChangesRequested;

        emit RequestChangesCompleted(approvalId, msg.sender);
        emit StatusResolved(approvalId, Status.ChangesRequested);
    }

    /// @notice Mark the approval as timed out (callable by anyone after deadline)
    function timeout(bytes32 approvalId) external {
        ApprovalData storage approval = approvals[approvalId];
        require(approval.exists, "Approval: not found");
        require(approval.status == Status.Pending, "Approval: not in Pending status");
        require(block.timestamp >= approval.deadline, "Approval: deadline not yet reached");

        approval.status = Status.TimedOut;

        emit TimeoutCompleted(approvalId);
        emit StatusResolved(approvalId, Status.TimedOut);
    }

    /// @notice Get the approval status and vote counts
    function getApprovalStatus(bytes32 approvalId) external view returns (ApprovalView memory) {
        ApprovalData storage approval = approvals[approvalId];
        require(approval.exists, "Approval: not found");

        return ApprovalView({
            approvalId: approval.approvalId,
            subjectRef: approval.subjectRef,
            requester: approval.requester,
            requiredApprovals: approval.requiredApprovals,
            deadline: approval.deadline,
            status: approval.status,
            approveCount: approval.approveCount,
            denyCount: approval.denyCount,
            changesCount: approval.changesCount,
            totalVotes: approval.approveCount + approval.denyCount + approval.changesCount
        });
    }

    // --- Internal ---

    function _isApprover(ApprovalData storage approval, address addr) internal view returns (bool) {
        for (uint256 i = 0; i < approval.approvers.length; i++) {
            if (approval.approvers[i] == addr) {
                return true;
            }
        }
        return false;
    }
}
