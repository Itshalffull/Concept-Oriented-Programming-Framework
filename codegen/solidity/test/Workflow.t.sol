// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Workflow.sol";

contract WorkflowTest is Test {
    Workflow public target;

    event WorkflowCreated(bytes32 indexed workflowId);
    event StateDefined(bytes32 indexed workflowId, string name);
    event TransitionDefined(bytes32 indexed workflowId, bytes32 fromState, bytes32 toState);
    event Transitioned(bytes32 indexed workflowId, bytes32 indexed entityId, bytes32 fromState, bytes32 toState);

    function setUp() public {
        target = new Workflow();
    }

    // --- createWorkflow tests ---

    function test_createWorkflow_creates() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        // Verify by defining a state (only works on existing workflow)
        bytes32 sh = keccak256("draft");
        target.defineState(wid, sh, "Draft", "{}");
        Workflow.State memory s = target.getState(wid, sh);
        assertEq(s.name, "Draft");
    }

    function test_createWorkflow_emits_event() public {
        bytes32 wid = keccak256("w1");

        vm.expectEmit(true, false, false, false);
        emit WorkflowCreated(wid);

        target.createWorkflow(wid);
    }

    function test_createWorkflow_zero_id_reverts() public {
        vm.expectRevert("Workflow ID cannot be zero");
        target.createWorkflow(bytes32(0));
    }

    function test_createWorkflow_duplicate_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        vm.expectRevert("Workflow already exists");
        target.createWorkflow(wid);
    }

    // --- defineState tests ---

    function test_defineState_stores_state() public {
        bytes32 wid = keccak256("w1");
        bytes32 sh = keccak256("draft");
        target.createWorkflow(wid);
        target.defineState(wid, sh, "Draft", '{"color":"blue"}');

        Workflow.State memory s = target.getState(wid, sh);
        assertEq(s.name, "Draft");
        assertEq(s.config, '{"color":"blue"}');
        assertTrue(s.exists);
    }

    function test_defineState_emits_event() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        vm.expectEmit(true, false, false, true);
        emit StateDefined(wid, "Draft");

        target.defineState(wid, keccak256("draft"), "Draft", "{}");
    }

    function test_defineState_nonexistent_workflow_reverts() public {
        vm.expectRevert("Workflow not found");
        target.defineState(keccak256("none"), keccak256("s"), "State", "{}");
    }

    function test_defineState_zero_hash_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        vm.expectRevert("State hash cannot be zero");
        target.defineState(wid, bytes32(0), "State", "{}");
    }

    function test_defineState_empty_name_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        vm.expectRevert("State name cannot be empty");
        target.defineState(wid, keccak256("s"), "", "{}");
    }

    // --- defineTransition tests ---

    function test_defineTransition_creates_transition() public {
        bytes32 wid = keccak256("w1");
        bytes32 from = keccak256("draft");
        bytes32 to = keccak256("published");
        target.createWorkflow(wid);
        target.defineState(wid, from, "Draft", "{}");
        target.defineState(wid, to, "Published", "{}");

        target.defineTransition(wid, from, to, "isReviewed");
    }

    function test_defineTransition_emits_event() public {
        bytes32 wid = keccak256("w1");
        bytes32 from = keccak256("draft");
        bytes32 to = keccak256("published");
        target.createWorkflow(wid);
        target.defineState(wid, from, "Draft", "{}");
        target.defineState(wid, to, "Published", "{}");

        vm.expectEmit(true, false, false, true);
        emit TransitionDefined(wid, from, to);

        target.defineTransition(wid, from, to, "guard");
    }

    function test_defineTransition_nonexistent_workflow_reverts() public {
        vm.expectRevert("Workflow not found");
        target.defineTransition(keccak256("none"), keccak256("a"), keccak256("b"), "g");
    }

    function test_defineTransition_from_state_missing_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);
        target.defineState(wid, keccak256("to"), "To", "{}");

        vm.expectRevert("From state not found");
        target.defineTransition(wid, keccak256("missing"), keccak256("to"), "g");
    }

    function test_defineTransition_to_state_missing_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);
        target.defineState(wid, keccak256("from"), "From", "{}");

        vm.expectRevert("To state not found");
        target.defineTransition(wid, keccak256("from"), keccak256("missing"), "g");
    }

    // --- transition tests ---

    function test_transition_updates_current_state() public {
        bytes32 wid = keccak256("w1");
        bytes32 draft = keccak256("draft");
        bytes32 published = keccak256("published");
        bytes32 entity = keccak256("article1");
        target.createWorkflow(wid);
        target.defineState(wid, draft, "Draft", "{}");
        target.defineState(wid, published, "Published", "{}");

        target.transition(wid, entity, draft);
        assertEq(target.getCurrentState(wid, entity), draft);

        target.transition(wid, entity, published);
        assertEq(target.getCurrentState(wid, entity), published);
    }

    function test_transition_emits_event() public {
        bytes32 wid = keccak256("w1");
        bytes32 draft = keccak256("draft");
        bytes32 entity = keccak256("article1");
        target.createWorkflow(wid);
        target.defineState(wid, draft, "Draft", "{}");

        vm.expectEmit(true, true, false, true);
        emit Transitioned(wid, entity, bytes32(0), draft);

        target.transition(wid, entity, draft);
    }

    function test_transition_nonexistent_workflow_reverts() public {
        vm.expectRevert("Workflow not found");
        target.transition(keccak256("none"), keccak256("e"), keccak256("s"));
    }

    function test_transition_nonexistent_state_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        vm.expectRevert("Target state not found");
        target.transition(wid, keccak256("e"), keccak256("missing"));
    }

    // --- getCurrentState tests ---

    function test_getCurrentState_returns_zero_for_new_entity() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        assertEq(target.getCurrentState(wid, keccak256("entity")), bytes32(0));
    }

    // --- getState tests ---

    function test_getState_nonexistent_reverts() public {
        bytes32 wid = keccak256("w1");
        target.createWorkflow(wid);

        vm.expectRevert("State not found");
        target.getState(wid, keccak256("nonexistent"));
    }
}
