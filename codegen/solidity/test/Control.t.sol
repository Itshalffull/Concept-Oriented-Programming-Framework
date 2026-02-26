// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Control.sol";

contract ControlTest is Test {
    Control public target;

    event ControlCreated(bytes32 indexed controlId);
    event Interacted(bytes32 indexed controlId);
    event ValueSet(bytes32 indexed controlId, string value);

    function setUp() public {
        target = new Control();
    }

    // --- create tests ---

    function test_create_stores_control() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "button", "Submit", "", "form.submit", "onClick:submit");

        Control.ControlData memory c = target.getControl(cid);
        assertEq(c.controlType, "button");
        assertEq(c.label, "Submit");
        assertEq(c.value, "");
        assertEq(c.binding, "form.submit");
        assertEq(c.action, "onClick:submit");
        assertTrue(c.exists);
    }

    function test_create_emits_event() public {
        bytes32 cid = keccak256("c1");

        vm.expectEmit(true, false, false, false);
        emit ControlCreated(cid);

        target.create(cid, "button", "Submit", "", "binding", "action");
    }

    function test_create_zero_id_reverts() public {
        vm.expectRevert("Control ID cannot be zero");
        target.create(bytes32(0), "button", "Submit", "", "b", "a");
    }

    function test_create_duplicate_reverts() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "button", "Submit", "", "b", "a");

        vm.expectRevert("Control already exists");
        target.create(cid, "input", "Name", "", "b2", "a2");
    }

    function test_create_empty_type_reverts() public {
        vm.expectRevert("Control type cannot be empty");
        target.create(keccak256("c1"), "", "Label", "", "b", "a");
    }

    // --- setValue tests ---

    function test_setValue_updates_value() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "input", "Name", "initial", "b", "a");
        target.setValue(cid, "updated");

        assertEq(target.getValue(cid), "updated");
    }

    function test_setValue_emits_events() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "input", "Name", "", "b", "a");

        vm.expectEmit(true, false, false, true);
        emit ValueSet(cid, "new_value");

        target.setValue(cid, "new_value");
    }

    function test_setValue_nonexistent_reverts() public {
        vm.expectRevert("Control not found");
        target.setValue(keccak256("nonexistent"), "value");
    }

    // --- getValue tests ---

    function test_getValue_returns_current_value() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "input", "Name", "hello", "b", "a");

        assertEq(target.getValue(cid), "hello");
    }

    function test_getValue_nonexistent_reverts() public {
        vm.expectRevert("Control not found");
        target.getValue(keccak256("nonexistent"));
    }

    // --- getControl tests ---

    function test_getControl_nonexistent_reverts() public {
        vm.expectRevert("Control not found");
        target.getControl(keccak256("nonexistent"));
    }

    // --- controlExists tests ---

    function test_controlExists_returns_true() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "button", "Ok", "", "b", "a");

        assertTrue(target.controlExists(cid));
    }

    function test_controlExists_returns_false() public {
        assertFalse(target.controlExists(keccak256("unknown")));
    }
}
