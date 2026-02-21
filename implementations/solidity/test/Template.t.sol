// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Template.sol";

contract TemplateTest is Test {
    Template public target;

    event TemplateDefined(bytes32 indexed templateId);
    event TriggerRegistered(bytes32 indexed templateId);

    function setUp() public {
        target = new Template();
    }

    // --- defineTemplate tests ---

    function test_defineTemplate_stores_template() public {
        bytes32 tid = keccak256("t1");
        target.defineTemplate(tid, "heading;paragraph;list", "title:string,count:uint");

        Template.TemplateData memory t = target.getTemplate(tid);
        assertEq(t.blockTree, "heading;paragraph;list");
        assertEq(t.variables, "title:string,count:uint");
        assertEq(bytes(t.triggerCondition).length, 0);
        assertTrue(t.exists);
    }

    function test_defineTemplate_emits_event() public {
        bytes32 tid = keccak256("t1");

        vm.expectEmit(true, false, false, false);
        emit TemplateDefined(tid);

        target.defineTemplate(tid, "blockTree", "vars");
    }

    function test_defineTemplate_duplicate_reverts() public {
        bytes32 tid = keccak256("t1");
        target.defineTemplate(tid, "blockTree", "vars");

        vm.expectRevert("Template already exists");
        target.defineTemplate(tid, "other", "other");
    }

    // --- registerTrigger tests ---

    function test_registerTrigger_sets_condition() public {
        bytes32 tid = keccak256("t1");
        target.defineTemplate(tid, "blockTree", "vars");
        target.registerTrigger(tid, "on:create:page");

        Template.TemplateData memory t = target.getTemplate(tid);
        assertEq(t.triggerCondition, "on:create:page");
    }

    function test_registerTrigger_emits_event() public {
        bytes32 tid = keccak256("t1");
        target.defineTemplate(tid, "blockTree", "vars");

        vm.expectEmit(true, false, false, false);
        emit TriggerRegistered(tid);

        target.registerTrigger(tid, "on:create:page");
    }

    function test_registerTrigger_nonexistent_reverts() public {
        vm.expectRevert("Template does not exist");
        target.registerTrigger(keccak256("nonexistent"), "condition");
    }

    // --- getTemplate tests ---

    function test_getTemplate_nonexistent_reverts() public {
        vm.expectRevert("Template does not exist");
        target.getTemplate(keccak256("nonexistent"));
    }

    // --- templateExists tests ---

    function test_templateExists_returns_true_for_existing() public {
        bytes32 tid = keccak256("t1");
        target.defineTemplate(tid, "blockTree", "vars");

        assertTrue(target.templateExists(tid));
    }

    function test_templateExists_returns_false_for_unknown() public {
        assertFalse(target.templateExists(keccak256("unknown")));
    }
}
