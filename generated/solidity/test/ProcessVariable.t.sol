// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProcessVariable.sol";

/// @title ProcessVariable Conformance Tests
/// @notice Tests for scoped variable management within process runs
contract ProcessVariableTest is Test {
    ProcessVariable public target;

    bytes32 constant RUN_REF = keccak256("run-001");
    bytes32 constant RUN_REF_2 = keccak256("run-002");

    function setUp() public {
        target = new ProcessVariable();
    }

    /// @notice Setting and getting a variable
    function test_setVar_and_getVar() public {
        target.setVar(RUN_REF, "orderId", "12345");

        string memory val = target.getVar(RUN_REF, "orderId");
        assertEq(val, "12345");
    }

    /// @notice Setting a variable overwrites existing value
    function test_setVar_overwrites() public {
        target.setVar(RUN_REF, "status", "pending");
        target.setVar(RUN_REF, "status", "completed");

        string memory val = target.getVar(RUN_REF, "status");
        assertEq(val, "completed");
    }

    /// @notice Getting a non-existent variable reverts
    function test_getVar_nonexistent_reverts() public {
        vm.expectRevert("ProcessVariable: variable not found");
        target.getVar(RUN_REF, "missing");
    }

    /// @notice Setting with empty name reverts
    function test_setVar_empty_name_reverts() public {
        vm.expectRevert("ProcessVariable: name required");
        target.setVar(RUN_REF, "", "value");
    }

    /// @notice Merging appends to existing value
    function test_mergeVar() public {
        target.setVar(RUN_REF, "log", "step1;");
        target.mergeVar(RUN_REF, "log", "step2;");

        string memory val = target.getVar(RUN_REF, "log");
        assertEq(val, "step1;step2;");
    }

    /// @notice Merging a non-existent variable reverts
    function test_mergeVar_nonexistent_reverts() public {
        vm.expectRevert("ProcessVariable: variable not found for merge");
        target.mergeVar(RUN_REF, "missing", "value");
    }

    /// @notice Deleting a variable removes it
    function test_deleteVar() public {
        target.setVar(RUN_REF, "temp", "data");
        target.deleteVar(RUN_REF, "temp");

        vm.expectRevert("ProcessVariable: variable not found");
        target.getVar(RUN_REF, "temp");
    }

    /// @notice Deleting a non-existent variable reverts
    function test_deleteVar_nonexistent_reverts() public {
        vm.expectRevert("ProcessVariable: variable not found");
        target.deleteVar(RUN_REF, "missing");
    }

    /// @notice listVars returns all existing variables for a run
    function test_listVars() public {
        target.setVar(RUN_REF, "alpha", "1");
        target.setVar(RUN_REF, "beta", "2");
        target.setVar(RUN_REF, "gamma", "3");

        ProcessVariable.VarEntry[] memory entries = target.listVars(RUN_REF);
        assertEq(entries.length, 3);
        assertEq(entries[0].name, "alpha");
        assertEq(entries[0].value, "1");
        assertEq(entries[1].name, "beta");
        assertEq(entries[2].name, "gamma");
    }

    /// @notice listVars excludes deleted variables
    function test_listVars_excludes_deleted() public {
        target.setVar(RUN_REF, "keep", "yes");
        target.setVar(RUN_REF, "remove", "no");
        target.deleteVar(RUN_REF, "remove");

        ProcessVariable.VarEntry[] memory entries = target.listVars(RUN_REF);
        assertEq(entries.length, 1);
        assertEq(entries[0].name, "keep");
    }

    /// @notice Variables are scoped per run
    function test_variables_scoped_per_run() public {
        target.setVar(RUN_REF, "shared", "run1");
        target.setVar(RUN_REF_2, "shared", "run2");

        assertEq(target.getVar(RUN_REF, "shared"), "run1");
        assertEq(target.getVar(RUN_REF_2, "shared"), "run2");
    }

    /// @notice listVars on empty run returns empty array
    function test_listVars_empty_run() public view {
        ProcessVariable.VarEntry[] memory entries = target.listVars(keccak256("empty"));
        assertEq(entries.length, 0);
    }

    /// @notice setVar emits event
    function test_setVar_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit ProcessVariable.SetVarCompleted(RUN_REF, "key", "val");

        target.setVar(RUN_REF, "key", "val");
    }

    /// @notice Re-setting a deleted variable works
    function test_reset_deleted_variable() public {
        target.setVar(RUN_REF, "ephemeral", "v1");
        target.deleteVar(RUN_REF, "ephemeral");
        target.setVar(RUN_REF, "ephemeral", "v2");

        assertEq(target.getVar(RUN_REF, "ephemeral"), "v2");
    }
}
