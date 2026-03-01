// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CompensationPlan
/// @notice Saga-style reverse compensation tracking for process rollback.
/// @dev Actions are registered in order and executed in reverse (LIFO) on trigger.

contract CompensationPlan {

    // --- Types ---

    enum PlanStatus { Active, Triggered, Completed, Failed }
    enum ActionStatus { Pending, Executed, Failed }

    struct CompensationAction {
        bytes32 actionId;
        string description;
        bytes32 stepRef;
        ActionStatus status;
    }

    struct PlanData {
        bytes32 planId;
        bytes32 runRef;
        PlanStatus status;
        uint256 nextToExecute;
        bool exists;
    }

    struct PlanView {
        bytes32 planId;
        bytes32 runRef;
        PlanStatus status;
        uint256 totalActions;
        uint256 executedCount;
        uint256 nextToExecute;
    }

    // --- Storage ---

    mapping(bytes32 => PlanData) private plans;
    mapping(bytes32 => CompensationAction[]) private planActions;

    // --- Events ---

    event RegisterCompleted(bytes32 indexed planId, bytes32 indexed actionId, string description);
    event TriggerCompleted(bytes32 indexed planId);
    event ExecuteNextCompleted(bytes32 indexed planId, bytes32 indexed actionId, uint256 remainingActions);
    event CompensationFailedMarked(bytes32 indexed planId, bytes32 indexed actionId);
    event PlanCompleted(bytes32 indexed planId);
    event PlanFailed(bytes32 indexed planId);

    // --- Actions ---

    /// @notice Register a compensation action in the plan (appended at the end, executed in reverse)
    function register(
        bytes32 planId,
        bytes32 runRef,
        bytes32 actionId,
        string calldata description,
        bytes32 stepRef
    ) external {
        PlanData storage plan = plans[planId];

        if (!plan.exists) {
            plans[planId] = PlanData({
                planId: planId,
                runRef: runRef,
                status: PlanStatus.Active,
                nextToExecute: 0,
                exists: true
            });
        }

        require(plan.status == PlanStatus.Active, "CompensationPlan: plan not Active");

        planActions[planId].push(CompensationAction({
            actionId: actionId,
            description: description,
            stepRef: stepRef,
            status: ActionStatus.Pending
        }));

        emit RegisterCompleted(planId, actionId, description);
    }

    /// @notice Trigger compensation, starting reverse execution
    function trigger(bytes32 planId) external {
        PlanData storage plan = plans[planId];
        require(plan.exists, "CompensationPlan: not found");
        require(plan.status == PlanStatus.Active, "CompensationPlan: plan not Active");

        uint256 actionCount = planActions[planId].length;
        require(actionCount > 0, "CompensationPlan: no actions registered");

        plan.status = PlanStatus.Triggered;
        // Set nextToExecute to last action index (reverse order)
        plan.nextToExecute = actionCount - 1;

        emit TriggerCompleted(planId);
    }

    /// @notice Execute the next compensation action (in reverse order)
    function executeNext(bytes32 planId) external {
        PlanData storage plan = plans[planId];
        require(plan.exists, "CompensationPlan: not found");
        require(plan.status == PlanStatus.Triggered, "CompensationPlan: plan not Triggered");

        CompensationAction[] storage actions = planActions[planId];
        uint256 idx = plan.nextToExecute;

        require(actions[idx].status == ActionStatus.Pending, "CompensationPlan: action not Pending");

        actions[idx].status = ActionStatus.Executed;

        uint256 remaining;
        if (idx == 0) {
            remaining = 0;
            plan.status = PlanStatus.Completed;
            emit PlanCompleted(planId);
        } else {
            plan.nextToExecute = idx - 1;
            remaining = idx;
        }

        emit ExecuteNextCompleted(planId, actions[idx].actionId, remaining);
    }

    /// @notice Mark the current compensation action as failed
    function markCompensationFailed(bytes32 planId) external {
        PlanData storage plan = plans[planId];
        require(plan.exists, "CompensationPlan: not found");
        require(plan.status == PlanStatus.Triggered, "CompensationPlan: plan not Triggered");

        CompensationAction[] storage actions = planActions[planId];
        uint256 idx = plan.nextToExecute;

        require(actions[idx].status == ActionStatus.Pending, "CompensationPlan: action not Pending");

        actions[idx].status = ActionStatus.Failed;
        plan.status = PlanStatus.Failed;

        emit CompensationFailedMarked(planId, actions[idx].actionId);
        emit PlanFailed(planId);
    }

    /// @notice Get plan status and progress
    function getPlan(bytes32 planId) external view returns (PlanView memory) {
        PlanData storage plan = plans[planId];
        require(plan.exists, "CompensationPlan: not found");

        CompensationAction[] storage actions = planActions[planId];
        uint256 executedCount = 0;
        for (uint256 i = 0; i < actions.length; i++) {
            if (actions[i].status == ActionStatus.Executed) {
                executedCount++;
            }
        }

        return PlanView({
            planId: plan.planId,
            runRef: plan.runRef,
            status: plan.status,
            totalActions: actions.length,
            executedCount: executedCount,
            nextToExecute: plan.nextToExecute
        });
    }

    /// @notice Get a specific action's details
    function getAction(bytes32 planId, uint256 index) external view returns (CompensationAction memory) {
        require(plans[planId].exists, "CompensationPlan: not found");
        require(index < planActions[planId].length, "CompensationPlan: index out of range");
        return planActions[planId][index];
    }
}
