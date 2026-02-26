// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AutomationRule.sol";

contract AutomationRuleTest is Test {
    AutomationRule public target;

    event RuleDefined(bytes32 indexed ruleId);
    event RuleEnabled(bytes32 indexed ruleId);
    event RuleDisabled(bytes32 indexed ruleId);

    function setUp() public {
        target = new AutomationRule();
    }

    // --- defineRule tests ---

    function test_defineRule_stores_rule() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "on:create", "type:task", "assign:owner");

        AutomationRule.Rule memory r = target.getRule(rid);
        assertEq(r.trigger, "on:create");
        assertEq(r.conditions, "type:task");
        assertEq(r.actions, "assign:owner");
        assertFalse(r.enabled);
        assertTrue(r.exists);
    }

    function test_defineRule_emits_event() public {
        bytes32 rid = keccak256("r1");

        vm.expectEmit(true, false, false, false);
        emit RuleDefined(rid);

        target.defineRule(rid, "trigger", "conditions", "actions");
    }

    function test_defineRule_zero_id_reverts() public {
        vm.expectRevert("Rule ID cannot be zero");
        target.defineRule(bytes32(0), "trigger", "cond", "action");
    }

    function test_defineRule_empty_trigger_reverts() public {
        vm.expectRevert("Trigger cannot be empty");
        target.defineRule(keccak256("r1"), "", "cond", "action");
    }

    function test_defineRule_empty_actions_reverts() public {
        vm.expectRevert("Actions cannot be empty");
        target.defineRule(keccak256("r1"), "trigger", "cond", "");
    }

    // --- enable tests ---

    function test_enable_sets_enabled_true() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");
        target.enable(rid);

        assertTrue(target.isEnabled(rid));
    }

    function test_enable_emits_event() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");

        vm.expectEmit(true, false, false, false);
        emit RuleEnabled(rid);

        target.enable(rid);
    }

    function test_enable_nonexistent_reverts() public {
        vm.expectRevert("Rule not found");
        target.enable(keccak256("nonexistent"));
    }

    function test_enable_already_enabled_reverts() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");
        target.enable(rid);

        vm.expectRevert("Rule already enabled");
        target.enable(rid);
    }

    // --- disable tests ---

    function test_disable_sets_enabled_false() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");
        target.enable(rid);
        target.disable(rid);

        assertFalse(target.isEnabled(rid));
    }

    function test_disable_emits_event() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");
        target.enable(rid);

        vm.expectEmit(true, false, false, false);
        emit RuleDisabled(rid);

        target.disable(rid);
    }

    function test_disable_nonexistent_reverts() public {
        vm.expectRevert("Rule not found");
        target.disable(keccak256("nonexistent"));
    }

    function test_disable_already_disabled_reverts() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");

        vm.expectRevert("Rule already disabled");
        target.disable(rid);
    }

    // --- getRule tests ---

    function test_getRule_nonexistent_reverts() public {
        vm.expectRevert("Rule not found");
        target.getRule(keccak256("nonexistent"));
    }

    // --- isEnabled tests ---

    function test_isEnabled_nonexistent_reverts() public {
        vm.expectRevert("Rule not found");
        target.isEnabled(keccak256("nonexistent"));
    }

    function test_isEnabled_default_false() public {
        bytes32 rid = keccak256("r1");
        target.defineRule(rid, "trigger", "cond", "action");

        assertFalse(target.isEnabled(rid));
    }
}
