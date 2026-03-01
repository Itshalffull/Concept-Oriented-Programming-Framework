// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Milestone.sol";

/// @title Milestone Conformance Tests
/// @notice Tests for milestone definition, evaluation, and revocation
contract MilestoneTest is Test {
    Milestone public target;

    bytes32 constant MS_ID = keccak256("milestone-001");
    bytes32 constant MS_ID_2 = keccak256("milestone-002");
    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant TARGET_1 = keccak256("step-a");
    bytes32 constant TARGET_2 = keccak256("var-threshold");

    function setUp() public {
        target = new Milestone();
    }

    function _defineDefaultMilestone() internal {
        uint8[] memory condTypes = new uint8[](2);
        condTypes[0] = uint8(Milestone.ConditionType.StepCompleted);
        condTypes[1] = uint8(Milestone.ConditionType.ThresholdMet);

        bytes32[] memory targetRefs = new bytes32[](2);
        targetRefs[0] = TARGET_1;
        targetRefs[1] = TARGET_2;

        string[] memory expectedValues = new string[](2);
        expectedValues[0] = "completed";
        expectedValues[1] = "100";

        target.define(MS_ID, RUN_REF, "Payment Milestone", "All payments processed", condTypes, targetRefs, expectedValues);
    }

    /// @notice Defining a milestone stores it in Defined status
    function test_define_stores_milestone() public {
        _defineDefaultMilestone();

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(view.name, "Payment Milestone");
        assertEq(view.description, "All payments processed");
        assertEq(uint8(view.status), uint8(Milestone.Status.Defined));
        assertEq(view.conditionCount, 2);
        assertEq(view.runRef, RUN_REF);
        assertGt(view.definedAt, 0);
    }

    /// @notice Duplicate milestone ID reverts
    function test_define_duplicate_reverts() public {
        _defineDefaultMilestone();

        uint8[] memory condTypes = new uint8[](0);
        bytes32[] memory targetRefs = new bytes32[](0);
        string[] memory expectedValues = new string[](0);

        vm.expectRevert("Milestone: already exists");
        target.define(MS_ID, RUN_REF, "Dup", "", condTypes, targetRefs, expectedValues);
    }

    /// @notice Defining with empty name reverts
    function test_define_empty_name_reverts() public {
        uint8[] memory condTypes = new uint8[](0);
        bytes32[] memory targetRefs = new bytes32[](0);
        string[] memory expectedValues = new string[](0);

        vm.expectRevert("Milestone: name required");
        target.define(MS_ID, RUN_REF, "", "", condTypes, targetRefs, expectedValues);
    }

    /// @notice Evaluating with all conditions met sets Reached
    function test_evaluate_all_met_reached() public {
        _defineDefaultMilestone();

        bool[] memory results = new bool[](2);
        results[0] = true;
        results[1] = true;

        target.evaluate(MS_ID, results);

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(uint8(view.status), uint8(Milestone.Status.Reached));
        assertGt(view.evaluatedAt, 0);
    }

    /// @notice Evaluating with some conditions not met sets NotReached
    function test_evaluate_partial_not_reached() public {
        _defineDefaultMilestone();

        bool[] memory results = new bool[](2);
        results[0] = true;
        results[1] = false;

        target.evaluate(MS_ID, results);

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(uint8(view.status), uint8(Milestone.Status.NotReached));
    }

    /// @notice Evaluating a NotReached milestone can transition to Reached
    function test_evaluate_retry_after_not_reached() public {
        _defineDefaultMilestone();

        // First evaluation: not reached
        bool[] memory partialResults = new bool[](2);
        partialResults[0] = true;
        partialResults[1] = false;
        target.evaluate(MS_ID, partialResults);

        // Second evaluation: all met
        bool[] memory fullResults = new bool[](2);
        fullResults[0] = true;
        fullResults[1] = true;
        target.evaluate(MS_ID, fullResults);

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(uint8(view.status), uint8(Milestone.Status.Reached));
    }

    /// @notice Evaluating with wrong number of results reverts
    function test_evaluate_results_mismatch_reverts() public {
        _defineDefaultMilestone();

        bool[] memory results = new bool[](1);
        results[0] = true;

        vm.expectRevert("Milestone: results length mismatch");
        target.evaluate(MS_ID, results);
    }

    /// @notice Evaluating a reached milestone reverts
    function test_evaluate_reached_reverts() public {
        _defineDefaultMilestone();

        bool[] memory results = new bool[](2);
        results[0] = true;
        results[1] = true;
        target.evaluate(MS_ID, results);

        vm.expectRevert("Milestone: cannot evaluate in current status");
        target.evaluate(MS_ID, results);
    }

    /// @notice Revoking a milestone sets Revoked status
    function test_revoke() public {
        _defineDefaultMilestone();

        target.revoke(MS_ID);

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(uint8(view.status), uint8(Milestone.Status.Revoked));
    }

    /// @notice Revoking an already revoked milestone reverts
    function test_revoke_already_revoked_reverts() public {
        _defineDefaultMilestone();
        target.revoke(MS_ID);

        vm.expectRevert("Milestone: already revoked");
        target.revoke(MS_ID);
    }

    /// @notice Revoking a reached milestone is allowed
    function test_revoke_reached() public {
        _defineDefaultMilestone();

        bool[] memory results = new bool[](2);
        results[0] = true;
        results[1] = true;
        target.evaluate(MS_ID, results);

        target.revoke(MS_ID);

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(uint8(view.status), uint8(Milestone.Status.Revoked));
    }

    /// @notice getConditions returns the conditions for a milestone
    function test_getConditions() public {
        _defineDefaultMilestone();

        Milestone.Condition[] memory conditions = target.getConditions(MS_ID);
        assertEq(conditions.length, 2);
        assertEq(uint8(conditions[0].condType), uint8(Milestone.ConditionType.StepCompleted));
        assertEq(conditions[0].targetRef, TARGET_1);
        assertEq(conditions[0].expectedValue, "completed");
        assertEq(uint8(conditions[1].condType), uint8(Milestone.ConditionType.ThresholdMet));
    }

    /// @notice getMilestonesByRun returns milestone IDs for a run
    function test_getMilestonesByRun() public {
        _defineDefaultMilestone();

        uint8[] memory condTypes = new uint8[](0);
        bytes32[] memory targetRefs = new bytes32[](0);
        string[] memory expectedValues = new string[](0);
        target.define(MS_ID_2, RUN_REF, "Second Milestone", "", condTypes, targetRefs, expectedValues);

        bytes32[] memory milestoneIds = target.getMilestonesByRun(RUN_REF);
        assertEq(milestoneIds.length, 2);
        assertEq(milestoneIds[0], MS_ID);
        assertEq(milestoneIds[1], MS_ID_2);
    }

    /// @notice Getting a non-existent milestone reverts
    function test_getMilestone_nonexistent_reverts() public {
        vm.expectRevert("Milestone: not found");
        target.getMilestone(keccak256("nonexistent"));
    }

    /// @notice Define emits event
    function test_define_emits_event() public {
        uint8[] memory condTypes = new uint8[](0);
        bytes32[] memory targetRefs = new bytes32[](0);
        string[] memory expectedValues = new string[](0);

        vm.expectEmit(true, true, false, true);
        emit Milestone.DefineCompleted(MS_ID, RUN_REF, "Simple");

        target.define(MS_ID, RUN_REF, "Simple", "", condTypes, targetRefs, expectedValues);
    }

    /// @notice Milestone with zero conditions can be defined and evaluated
    function test_zero_conditions_milestone() public {
        uint8[] memory condTypes = new uint8[](0);
        bytes32[] memory targetRefs = new bytes32[](0);
        string[] memory expectedValues = new string[](0);

        target.define(MS_ID, RUN_REF, "Auto", "Auto-reached", condTypes, targetRefs, expectedValues);

        bool[] memory results = new bool[](0);
        target.evaluate(MS_ID, results);

        Milestone.MilestoneView memory view = target.getMilestone(MS_ID);
        assertEq(uint8(view.status), uint8(Milestone.Status.Reached));
    }
}
