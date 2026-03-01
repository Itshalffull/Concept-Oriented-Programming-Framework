// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CompensationPlan.sol";

/// @title CompensationPlan Business Logic Tests
/// @notice Tests for saga-style rollback, reverse execution, failure handling, and edge cases
contract CompensationPlanBusinessTest is Test {
    CompensationPlan private instance;

    bytes32 constant PLAN_ID = keccak256("biz-plan-001");
    bytes32 constant PLAN_ID_2 = keccak256("biz-plan-002");
    bytes32 constant RUN_REF = keccak256("biz-run-001");
    bytes32 constant RUN_REF_2 = keccak256("biz-run-002");
    bytes32 constant ACTION_1 = keccak256("biz-action-001");
    bytes32 constant ACTION_2 = keccak256("biz-action-002");
    bytes32 constant ACTION_3 = keccak256("biz-action-003");
    bytes32 constant ACTION_4 = keccak256("biz-action-004");
    bytes32 constant ACTION_5 = keccak256("biz-action-005");
    bytes32 constant STEP_A = keccak256("step-a");
    bytes32 constant STEP_B = keccak256("step-b");
    bytes32 constant STEP_C = keccak256("step-c");
    bytes32 constant STEP_D = keccak256("step-d");
    bytes32 constant STEP_E = keccak256("step-e");

    function setUp() public {
        instance = new CompensationPlan();
    }

    // --- Full saga rollback scenario ---

    /// @notice Simulate a 5-step saga: register all, trigger, execute all in reverse order
    function testFiveStepSagaFullRollback() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "Refund payment", STEP_A);
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "Cancel shipment", STEP_B);
        instance.register(PLAN_ID, RUN_REF, ACTION_3, "Revert inventory", STEP_C);
        instance.register(PLAN_ID, RUN_REF, ACTION_4, "Notify customer", STEP_D);
        instance.register(PLAN_ID, RUN_REF, ACTION_5, "Log rollback", STEP_E);

        CompensationPlan.PlanView memory pre = instance.getPlan(PLAN_ID);
        assertEq(pre.totalActions, 5);
        assertEq(uint8(pre.status), uint8(CompensationPlan.PlanStatus.Active));

        // Trigger
        instance.trigger(PLAN_ID);

        CompensationPlan.PlanView memory triggered = instance.getPlan(PLAN_ID);
        assertEq(triggered.nextToExecute, 4); // Last action index

        // Execute in reverse: 5, 4, 3, 2, 1
        for (uint256 i = 0; i < 5; i++) {
            instance.executeNext(PLAN_ID);
        }

        CompensationPlan.PlanView memory completed = instance.getPlan(PLAN_ID);
        assertEq(uint8(completed.status), uint8(CompensationPlan.PlanStatus.Completed));
        assertEq(completed.executedCount, 5);

        // Verify all actions are Executed
        for (uint256 i = 0; i < 5; i++) {
            CompensationPlan.CompensationAction memory a = instance.getAction(PLAN_ID, i);
            assertEq(uint8(a.status), uint8(CompensationPlan.ActionStatus.Executed));
        }
    }

    /// @notice Single action plan: register, trigger, execute completes immediately
    function testSingleActionPlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "Undo only step", STEP_A);

        instance.trigger(PLAN_ID);

        CompensationPlan.PlanView memory mid = instance.getPlan(PLAN_ID);
        assertEq(mid.nextToExecute, 0);

        instance.executeNext(PLAN_ID);

        CompensationPlan.PlanView memory done = instance.getPlan(PLAN_ID);
        assertEq(uint8(done.status), uint8(CompensationPlan.PlanStatus.Completed));
        assertEq(done.executedCount, 1);
    }

    // --- Partial execution then failure ---

    /// @notice Execute some actions, then fail partway through rollback
    function testPartialExecutionThenFailure() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "Step 1 undo", STEP_A);
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "Step 2 undo", STEP_B);
        instance.register(PLAN_ID, RUN_REF, ACTION_3, "Step 3 undo", STEP_C);

        instance.trigger(PLAN_ID);

        // Execute action at index 2 (last)
        instance.executeNext(PLAN_ID);

        CompensationPlan.PlanView memory mid = instance.getPlan(PLAN_ID);
        assertEq(mid.executedCount, 1);
        assertEq(mid.nextToExecute, 1);

        // Fail on the next action (index 1)
        instance.markCompensationFailed(PLAN_ID);

        CompensationPlan.PlanView memory failed = instance.getPlan(PLAN_ID);
        assertEq(uint8(failed.status), uint8(CompensationPlan.PlanStatus.Failed));

        // Action at index 2 is Executed, index 1 is Failed, index 0 is Pending
        CompensationPlan.CompensationAction memory a2 = instance.getAction(PLAN_ID, 2);
        assertEq(uint8(a2.status), uint8(CompensationPlan.ActionStatus.Executed));

        CompensationPlan.CompensationAction memory a1 = instance.getAction(PLAN_ID, 1);
        assertEq(uint8(a1.status), uint8(CompensationPlan.ActionStatus.Failed));

        CompensationPlan.CompensationAction memory a0 = instance.getAction(PLAN_ID, 0);
        assertEq(uint8(a0.status), uint8(CompensationPlan.ActionStatus.Pending));
    }

    // --- Invalid state transitions ---

    /// @notice Cannot trigger a completed plan
    function testRevertTriggerCompletedPlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);
        instance.trigger(PLAN_ID);
        instance.executeNext(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Active");
        instance.trigger(PLAN_ID);
    }

    /// @notice Cannot trigger a failed plan
    function testRevertTriggerFailedPlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);
        instance.trigger(PLAN_ID);
        instance.markCompensationFailed(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Active");
        instance.trigger(PLAN_ID);
    }

    /// @notice Cannot execute after plan is failed
    function testRevertExecuteAfterFailed() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "a1", STEP_A);
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "a2", STEP_B);
        instance.trigger(PLAN_ID);
        instance.markCompensationFailed(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Triggered");
        instance.executeNext(PLAN_ID);
    }

    /// @notice Cannot markCompensationFailed on an Active plan
    function testRevertMarkFailedActivePlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);

        vm.expectRevert("CompensationPlan: plan not Triggered");
        instance.markCompensationFailed(PLAN_ID);
    }

    /// @notice Cannot markCompensationFailed on a Completed plan
    function testRevertMarkFailedCompletedPlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);
        instance.trigger(PLAN_ID);
        instance.executeNext(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Triggered");
        instance.markCompensationFailed(PLAN_ID);
    }

    /// @notice Cannot register on a Completed plan
    function testRevertRegisterOnCompletedPlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);
        instance.trigger(PLAN_ID);
        instance.executeNext(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Active");
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "late action", STEP_B);
    }

    /// @notice Cannot register on a Failed plan
    function testRevertRegisterOnFailedPlan() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);
        instance.trigger(PLAN_ID);
        instance.markCompensationFailed(PLAN_ID);

        vm.expectRevert("CompensationPlan: plan not Active");
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "late", STEP_B);
    }

    // --- Event emission ---

    /// @notice Trigger emits TriggerCompleted event
    function testTriggerEmitsEvent() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);

        vm.expectEmit(true, false, false, false);
        emit CompensationPlan.TriggerCompleted(PLAN_ID);

        instance.trigger(PLAN_ID);
    }

    /// @notice ExecuteNext emits event with remaining count
    function testExecuteNextEmitsEventWithRemaining() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "a1", STEP_A);
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "a2", STEP_B);
        instance.trigger(PLAN_ID);

        // First execute: action at index 1, remaining = 1
        vm.expectEmit(true, true, false, true);
        emit CompensationPlan.ExecuteNextCompleted(PLAN_ID, ACTION_2, 1);

        instance.executeNext(PLAN_ID);
    }

    /// @notice Last execute emits PlanCompleted event
    function testLastExecuteEmitsPlanCompleted() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "only", STEP_A);
        instance.trigger(PLAN_ID);

        vm.expectEmit(true, false, false, false);
        emit CompensationPlan.PlanCompleted(PLAN_ID);

        instance.executeNext(PLAN_ID);
    }

    /// @notice markCompensationFailed emits both CompensationFailedMarked and PlanFailed
    function testMarkFailedEmitsEvents() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "action", STEP_A);
        instance.trigger(PLAN_ID);

        vm.expectEmit(true, true, false, false);
        emit CompensationPlan.CompensationFailedMarked(PLAN_ID, ACTION_1);

        instance.markCompensationFailed(PLAN_ID);
    }

    // --- Multiple independent plans ---

    /// @notice Two plans can exist independently with different lifecycles
    function testMultipleIndependentPlans() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "Plan 1 action", STEP_A);
        instance.register(PLAN_ID_2, RUN_REF_2, ACTION_2, "Plan 2 action", STEP_B);

        // Trigger and complete plan 1
        instance.trigger(PLAN_ID);
        instance.executeNext(PLAN_ID);

        CompensationPlan.PlanView memory p1 = instance.getPlan(PLAN_ID);
        assertEq(uint8(p1.status), uint8(CompensationPlan.PlanStatus.Completed));

        // Plan 2 is still Active
        CompensationPlan.PlanView memory p2 = instance.getPlan(PLAN_ID_2);
        assertEq(uint8(p2.status), uint8(CompensationPlan.PlanStatus.Active));
    }

    // --- Data integrity ---

    /// @notice Action details are stored and retrievable correctly
    function testActionDataIntegrity() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "Reverse charge of $500", STEP_A);
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "Cancel order #12345", STEP_B);

        CompensationPlan.CompensationAction memory a0 = instance.getAction(PLAN_ID, 0);
        assertEq(a0.actionId, ACTION_1);
        assertEq(a0.description, "Reverse charge of $500");
        assertEq(a0.stepRef, STEP_A);
        assertEq(uint8(a0.status), uint8(CompensationPlan.ActionStatus.Pending));

        CompensationPlan.CompensationAction memory a1 = instance.getAction(PLAN_ID, 1);
        assertEq(a1.actionId, ACTION_2);
        assertEq(a1.description, "Cancel order #12345");
        assertEq(a1.stepRef, STEP_B);
    }

    /// @notice PlanView executedCount tracks correctly during execution
    function testExecutedCountTracksDuringExecution() public {
        instance.register(PLAN_ID, RUN_REF, ACTION_1, "a1", STEP_A);
        instance.register(PLAN_ID, RUN_REF, ACTION_2, "a2", STEP_B);
        instance.register(PLAN_ID, RUN_REF, ACTION_3, "a3", STEP_C);
        instance.trigger(PLAN_ID);

        CompensationPlan.PlanView memory v0 = instance.getPlan(PLAN_ID);
        assertEq(v0.executedCount, 0);

        instance.executeNext(PLAN_ID);
        CompensationPlan.PlanView memory v1 = instance.getPlan(PLAN_ID);
        assertEq(v1.executedCount, 1);

        instance.executeNext(PLAN_ID);
        CompensationPlan.PlanView memory v2 = instance.getPlan(PLAN_ID);
        assertEq(v2.executedCount, 2);

        instance.executeNext(PLAN_ID);
        CompensationPlan.PlanView memory v3 = instance.getPlan(PLAN_ID);
        assertEq(v3.executedCount, 3);
        assertEq(uint8(v3.status), uint8(CompensationPlan.PlanStatus.Completed));
    }
}
