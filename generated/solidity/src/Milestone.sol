// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Milestone
/// @notice Goal tracking with condition evaluation for process milestones.
/// @dev Milestones can be defined, evaluated (reached or not), and revoked.

contract Milestone {

    // --- Types ---

    enum Status { Defined, Reached, NotReached, Revoked }

    enum ConditionType { StepCompleted, VariableEquals, ThresholdMet, Custom }

    struct Condition {
        ConditionType condType;
        bytes32 targetRef;
        string expectedValue;
    }

    struct MilestoneData {
        bytes32 milestoneId;
        bytes32 runRef;
        string name;
        string description;
        Status status;
        uint256 definedAt;
        uint256 evaluatedAt;
        bool exists;
    }

    struct MilestoneView {
        bytes32 milestoneId;
        bytes32 runRef;
        string name;
        string description;
        Status status;
        uint256 definedAt;
        uint256 evaluatedAt;
        uint256 conditionCount;
    }

    // --- Storage ---

    mapping(bytes32 => MilestoneData) private milestones;
    mapping(bytes32 => Condition[]) private milestoneConditions;
    mapping(bytes32 => bytes32[]) private runMilestones;

    // --- Events ---

    event DefineCompleted(bytes32 indexed milestoneId, bytes32 indexed runRef, string name);
    event EvaluateCompleted(bytes32 indexed milestoneId, Status status);
    event RevokeCompleted(bytes32 indexed milestoneId);

    // --- Actions ---

    /// @notice Define a new milestone with conditions
    function define(
        bytes32 milestoneId,
        bytes32 runRef,
        string calldata name,
        string calldata description,
        uint8[] calldata condTypes,
        bytes32[] calldata targetRefs,
        string[] calldata expectedValues
    ) external {
        require(!milestones[milestoneId].exists, "Milestone: already exists");
        require(bytes(name).length > 0, "Milestone: name required");
        require(condTypes.length == targetRefs.length, "Milestone: condition arrays mismatch");
        require(condTypes.length == expectedValues.length, "Milestone: condition arrays mismatch");

        milestones[milestoneId] = MilestoneData({
            milestoneId: milestoneId,
            runRef: runRef,
            name: name,
            description: description,
            status: Status.Defined,
            definedAt: block.timestamp,
            evaluatedAt: 0,
            exists: true
        });

        for (uint256 i = 0; i < condTypes.length; i++) {
            milestoneConditions[milestoneId].push(Condition({
                condType: ConditionType(condTypes[i]),
                targetRef: targetRefs[i],
                expectedValue: expectedValues[i]
            }));
        }

        runMilestones[runRef].push(milestoneId);

        emit DefineCompleted(milestoneId, runRef, name);
    }

    /// @notice Evaluate a milestone. Pass in which conditions are satisfied.
    /// @param milestoneId The milestone to evaluate
    /// @param conditionResults Array of booleans indicating if each condition is met
    function evaluate(bytes32 milestoneId, bool[] calldata conditionResults) external {
        MilestoneData storage ms = milestones[milestoneId];
        require(ms.exists, "Milestone: not found");
        require(
            ms.status == Status.Defined || ms.status == Status.NotReached,
            "Milestone: cannot evaluate in current status"
        );

        Condition[] storage conditions = milestoneConditions[milestoneId];
        require(conditionResults.length == conditions.length, "Milestone: results length mismatch");

        bool allMet = true;
        for (uint256 i = 0; i < conditionResults.length; i++) {
            if (!conditionResults[i]) {
                allMet = false;
                break;
            }
        }

        ms.status = allMet ? Status.Reached : Status.NotReached;
        ms.evaluatedAt = block.timestamp;

        emit EvaluateCompleted(milestoneId, ms.status);
    }

    /// @notice Revoke a milestone (e.g., when conditions are invalidated)
    function revoke(bytes32 milestoneId) external {
        MilestoneData storage ms = milestones[milestoneId];
        require(ms.exists, "Milestone: not found");
        require(ms.status != Status.Revoked, "Milestone: already revoked");

        ms.status = Status.Revoked;
        ms.evaluatedAt = block.timestamp;

        emit RevokeCompleted(milestoneId);
    }

    /// @notice Get milestone details
    function getMilestone(bytes32 milestoneId) external view returns (MilestoneView memory) {
        MilestoneData storage ms = milestones[milestoneId];
        require(ms.exists, "Milestone: not found");

        return MilestoneView({
            milestoneId: ms.milestoneId,
            runRef: ms.runRef,
            name: ms.name,
            description: ms.description,
            status: ms.status,
            definedAt: ms.definedAt,
            evaluatedAt: ms.evaluatedAt,
            conditionCount: milestoneConditions[milestoneId].length
        });
    }

    /// @notice Get conditions for a milestone
    function getConditions(bytes32 milestoneId) external view returns (Condition[] memory) {
        require(milestones[milestoneId].exists, "Milestone: not found");
        return milestoneConditions[milestoneId];
    }

    /// @notice Get milestone IDs for a run
    function getMilestonesByRun(bytes32 runRef) external view returns (bytes32[] memory) {
        return runMilestones[runRef];
    }
}
