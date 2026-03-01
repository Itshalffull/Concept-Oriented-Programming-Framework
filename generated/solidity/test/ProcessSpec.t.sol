// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessSpec.sol";

/// @title ProcessSpec Conformance Tests
/// @notice Tests for process specification lifecycle management
contract ProcessSpecTest is Test {
    ProcessSpec public target;

    bytes32 constant SPEC_ID = keccak256("spec-001");
    bytes32 constant STEP_A = keccak256("step-a");
    bytes32 constant STEP_B = keccak256("step-b");
    bytes32 constant STEP_C = keccak256("step-c");

    function setUp() public {
        target = new ProcessSpec();
    }

    function _createDefaultSpec() internal {
        bytes32[] memory stepIds = new bytes32[](2);
        stepIds[0] = STEP_A;
        stepIds[1] = STEP_B;

        string[] memory stepNames = new string[](2);
        stepNames[0] = "Start";
        stepNames[1] = "End";

        bytes32[] memory edgeFroms = new bytes32[](1);
        edgeFroms[0] = STEP_A;

        bytes32[] memory edgeTos = new bytes32[](1);
        edgeTos[0] = STEP_B;

        target.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Order Process",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));
    }

    /// @notice Creating a spec stores it in Draft status
    function test_create_stores_draft() public {
        _createDefaultSpec();

        ProcessSpec.ProcessSpecView memory view = target.get(SPEC_ID);
        assertEq(view.name, "Order Process");
        assertEq(view.version, 1);
        assertEq(uint8(view.status), uint8(ProcessSpec.Status.Draft));
        assertEq(view.stepCount, 2);
        assertEq(view.edgeCount, 1);
    }

    /// @notice Creating a spec with duplicate ID reverts
    function test_create_duplicate_reverts() public {
        _createDefaultSpec();

        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory edgeFroms = new bytes32[](0);
        bytes32[] memory edgeTos = new bytes32[](0);

        vm.expectRevert("ProcessSpec: already exists");
        target.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Duplicate",
            version: 2,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));
    }

    /// @notice Publishing transitions from Draft to Active
    function test_publish_draft_to_active() public {
        _createDefaultSpec();

        target.publish(SPEC_ID);

        ProcessSpec.ProcessSpecView memory view = target.get(SPEC_ID);
        assertEq(uint8(view.status), uint8(ProcessSpec.Status.Active));
    }

    /// @notice Publishing a non-draft spec reverts
    function test_publish_active_reverts() public {
        _createDefaultSpec();
        target.publish(SPEC_ID);

        vm.expectRevert("ProcessSpec: must be Draft to publish");
        target.publish(SPEC_ID);
    }

    /// @notice Deprecating transitions from Active to Deprecated
    function test_deprecate_active_to_deprecated() public {
        _createDefaultSpec();
        target.publish(SPEC_ID);

        target.deprecate(SPEC_ID);

        ProcessSpec.ProcessSpecView memory view = target.get(SPEC_ID);
        assertEq(uint8(view.status), uint8(ProcessSpec.Status.Deprecated));
    }

    /// @notice Deprecating a draft spec reverts
    function test_deprecate_draft_reverts() public {
        _createDefaultSpec();

        vm.expectRevert("ProcessSpec: must be Active to deprecate");
        target.deprecate(SPEC_ID);
    }

    /// @notice Updating a draft spec replaces steps and edges
    function test_update_replaces_data() public {
        _createDefaultSpec();

        bytes32[] memory newStepIds = new bytes32[](3);
        newStepIds[0] = STEP_A;
        newStepIds[1] = STEP_B;
        newStepIds[2] = STEP_C;

        string[] memory newStepNames = new string[](3);
        newStepNames[0] = "Init";
        newStepNames[1] = "Process";
        newStepNames[2] = "Finish";

        bytes32[] memory edgeFroms = new bytes32[](2);
        edgeFroms[0] = STEP_A;
        edgeFroms[1] = STEP_B;

        bytes32[] memory edgeTos = new bytes32[](2);
        edgeTos[0] = STEP_B;
        edgeTos[1] = STEP_C;

        target.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "Updated Process",
            stepIds: newStepIds,
            stepNames: newStepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));

        ProcessSpec.ProcessSpecView memory view = target.get(SPEC_ID);
        assertEq(view.name, "Updated Process");
        assertEq(view.stepCount, 3);
        assertEq(view.edgeCount, 2);
    }

    /// @notice Updating an active spec reverts
    function test_update_active_reverts() public {
        _createDefaultSpec();
        target.publish(SPEC_ID);

        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory edgeFroms = new bytes32[](0);
        bytes32[] memory edgeTos = new bytes32[](0);

        vm.expectRevert("ProcessSpec: must be Draft to update");
        target.update(ProcessSpec.UpdateInput({
            specId: SPEC_ID,
            name: "Fail",
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));
    }

    /// @notice Getting a non-existent spec reverts
    function test_get_nonexistent_reverts() public {
        vm.expectRevert("ProcessSpec: not found");
        target.get(keccak256("nonexistent"));
    }

    /// @notice Steps and edges can be retrieved individually
    function test_get_steps_and_edges() public {
        _createDefaultSpec();

        bytes32[] memory stepIds = target.getStepIds(SPEC_ID);
        assertEq(stepIds.length, 2);
        assertEq(stepIds[0], STEP_A);

        ProcessSpec.Step memory step = target.getStep(SPEC_ID, STEP_A);
        assertEq(step.name, "Start");

        ProcessSpec.Edge[] memory edges = target.getEdges(SPEC_ID);
        assertEq(edges.length, 1);
        assertEq(edges[0].from, STEP_A);
        assertEq(edges[0].to, STEP_B);
    }

    /// @notice Create emits the CreateCompleted event
    function test_create_emits_event() public {
        bytes32[] memory stepIds = new bytes32[](0);
        string[] memory stepNames = new string[](0);
        bytes32[] memory edgeFroms = new bytes32[](0);
        bytes32[] memory edgeTos = new bytes32[](0);

        vm.expectEmit(true, false, false, true);
        emit ProcessSpec.CreateCompleted(SPEC_ID, "Minimal", 1);

        target.create(ProcessSpec.CreateInput({
            specId: SPEC_ID,
            name: "Minimal",
            version: 1,
            stepIds: stepIds,
            stepNames: stepNames,
            edgeFroms: edgeFroms,
            edgeTos: edgeTos
        }));
    }
}
