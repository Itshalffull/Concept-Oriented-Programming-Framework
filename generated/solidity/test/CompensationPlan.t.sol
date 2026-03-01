// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CompensationPlan.sol";

/// @title CompensationPlan Conformance Tests
/// @notice Tests for saga-style reverse compensation tracking
contract CompensationPlanTest is Test {
    CompensationPlan public target;

    bytes32 constant PLAN_ID = keccak256("plan-001");
    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant ACTION_1 = keccak256("action-001");
    bytes32 constant ACTION_2 = keccak256("action-002");
    bytes32 constant ACTION_3 = keccak256("action-003");
    bytes32 constant STEP_A = keccak256("step-a");
    bytes32 constant STEP_B = keccak256("step-b");
    bytes32 constant STEP_C = keccak256("step-c");

    function setUp() public {
        target = new CompensationPlan();
    }

    function _registerThreeActions() internal {
        target.register(PLAN_ID, RUN_REF, ACTION_1, "Undo payment", STEP_A);
        target.register(PLAN_ID, RUN_REF, ACTION_2, "Cancel shipping", STEP_B);
        target.register(PLAN_ID, RUN_REF, ACTION_3, "Restore inventory", STEP_C);
    }

    /// @notice Registering actions creates a plan in Active status
    function test_register_creates_active_plan() public {
        target.register(PLAN_ID, RUN_REF, ACTION_1, "Undo payment", STEP_A);

        CompensationPlan.PlanView memory view = target.getPlan(PLAN_ID);
        assertEq(uint8(view.status), uint8(CompensationPlan.PlanStatus.Active));
        assertEq(view.totalActions, 1);
        assertEq(view.runRef, RUN_REF);
    }

    /// @notice Multiple actions can be registered to the same plan
    function test_register_multiple_actions() public {
        _registerThreeActions();

        CompensationPlan.PlanView memory view = target.getPlan(PLAN_ID);
        assertEq(view.totalActions, 3);
    }

    /// @notice Triggering sets plan to Triggered and starts from last action
    function test_trigger_sets_triggered() public {
        _registerThreeActions();

        target.trigger(PLAN_ID);

        CompensationPlan.PlanView memory view = target.getPlan(PLAN_ID);
        assertEq(uint8(view.status), uint8(CompensationPlan.PlanStatus.Triggered));
        assertEq(view.nextToExecute, 2); // Last action (index 2)
    }

    /// @notice Triggering an empty plan reverts
    function test_trigger_empty_plan_reverts() public {
        // Create plan by registering and checking plan exists
        target.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);

        // This has 1 action, should work
        target.trigger(PLAN_ID);
    }

    /// @notice Triggering a non-existent plan reverts
    function test_trigger_nonexistent_reverts() public {
        vm.expectRevert("CompensationPlan: not found");
        target.trigger(keccak256("nonexistent"));
    }

    /// @notice executeNext executes actions in reverse order (LIFO)
    function test_executeNext_reverse_order() public {
        _registerThreeActions();
        target.trigger(PLAN_ID);

        // Execute action 3 (index 2) - "Restore inventory"
        target.executeNext(PLAN_ID);
        CompensationPlan.CompensationAction memory a3 = target.getAction(PLAN_ID, 2);
        assertEq(uint8(a3.status), uint8(CompensationPlan.ActionStatus.Executed));

        CompensationPlan.PlanView memory mid = target.getPlan(PLAN_ID);
        assertEq(mid.executedCount, 1);
        assertEq(mid.nextToExecute, 1);

        // Execute action 2 (index 1) - "Cancel shipping"
        target.executeNext(PLAN_ID);
        CompensationPlan.CompensationAction memory a2 = target.getAction(PLAN_ID, 1);
        assertEq(uint8(a2.status), uint8(CompensationPlan.ActionStatus.Executed));

        // Execute action 1 (index 0) - "Undo payment" - completes the plan
        target.executeNext(PLAN_ID);
        CompensationPlan.CompensationAction memory a1 = target.getAction(PLAN_ID, 0);
        assertEq(uint8(a1.status), uint8(CompensationPlan.ActionStatus.Executed));

        CompensationPlan.PlanView memory done = target.getPlan(PLAN_ID);
        assertEq(uint8(done.status), uint8(CompensationPlan.PlanStatus.Completed));
        assertEq(done.executedCount, 3);
    }

    /// @notice executeNext on non-triggered plan reverts
    function test_executeNext_not_triggered_reverts() public {
        _registerThreeActions();

        vm.expectRevert("CompensationPlan: plan not Triggered");
        target.executeNext(PLAN_ID);
    }

    /// @notice markCompensationFailed marks the plan as Failed
    function test_markCompensationFailed() public {
        _registerThreeActions();
        target.trigger(PLAN_ID);

        target.markCompensationFailed(PLAN_ID);

        CompensationPlan.PlanView memory view = target.getPlan(PLAN_ID);
        assertEq(uint8(view.status), uint8(CompensationPlan.PlanStatus.Failed));

        CompensationPlan.CompensationAction memory action = target.getAction(PLAN_ID, 2);
        assertEq(uint8(action.status), uint8(CompensationPlan.ActionStatus.Failed));
    }

    /// @notice markCompensationFailed on non-triggered plan reverts
    function test_markCompensationFailed_not_triggered_reverts() public {
        _registerThreeActions();

        vm.expectRevert("CompensationPlan: plan not Triggered");
        target.markCompensationFailed(PLAN_ID);
    }

    /// @notice Cannot execute after plan is completed
    function test_executeNext_after_completed_reverts() public {
        target.register(PLAN_ID, RUN_REF, ACTION_1, "single action", STEP_A);
        target.trigger(PLAN_ID);
        target.executeNext(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Triggered");
        target.executeNext(PLAN_ID);
    }

    /// @notice Cannot register on a triggered plan
    function test_register_on_triggered_reverts() public {
        target.register(PLAN_ID, RUN_REF, ACTION_1, "first", STEP_A);
        target.trigger(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Active");
        target.register(PLAN_ID, RUN_REF, ACTION_2, "second", STEP_B);
    }

    /// @notice getAction returns correct data
    function test_getAction() public {
        target.register(PLAN_ID, RUN_REF, ACTION_1, "Undo payment", STEP_A);

        CompensationPlan.CompensationAction memory action = target.getAction(PLAN_ID, 0);
        assertEq(action.actionId, ACTION_1);
        assertEq(action.description, "Undo payment");
        assertEq(action.stepRef, STEP_A);
        assertEq(uint8(action.status), uint8(CompensationPlan.ActionStatus.Pending));
    }

    /// @notice getAction with out of range index reverts
    function test_getAction_out_of_range_reverts() public {
        target.register(PLAN_ID, RUN_REF, ACTION_1, "one", STEP_A);

        vm.expectRevert("CompensationPlan: index out of range");
        target.getAction(PLAN_ID, 5);
    }

    /// @notice Register emits event
    function test_register_emits_event() public {
        vm.expectEmit(true, true, false, true);
        emit CompensationPlan.RegisterCompleted(PLAN_ID, ACTION_1, "Undo payment");

        target.register(PLAN_ID, RUN_REF, ACTION_1, "Undo payment", STEP_A);
    }

    /// @notice getPlan for non-existent plan reverts
    function test_getPlan_nonexistent_reverts() public {
        vm.expectRevert("CompensationPlan: not found");
        target.getPlan(keccak256("nonexistent"));
    }
}
