// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FormBuilder.sol";

contract FormBuilderTest is Test {
    FormBuilder public target;

    event WidgetRegistered(string fieldType, string widgetId);

    function setUp() public {
        target = new FormBuilder();
    }

    // --- registerWidget tests ---

    function test_registerWidget_stores_widget() public {
        target.registerWidget("text", "TextInput");

        (bool found, string memory widgetId) = target.getWidget("text");
        assertTrue(found);
        assertEq(widgetId, "TextInput");
    }

    function test_registerWidget_emits_event() public {
        vm.expectEmit(false, false, false, true);
        emit WidgetRegistered("text", "TextInput");

        target.registerWidget("text", "TextInput");
    }

    function test_registerWidget_empty_field_type_reverts() public {
        vm.expectRevert("Field type cannot be empty");
        target.registerWidget("", "TextInput");
    }

    function test_registerWidget_empty_widget_id_reverts() public {
        vm.expectRevert("Widget ID cannot be empty");
        target.registerWidget("text", "");
    }

    function test_registerWidget_overwrites_existing() public {
        target.registerWidget("text", "TextInput");
        target.registerWidget("text", "RichTextEditor");

        (bool found, string memory widgetId) = target.getWidget("text");
        assertTrue(found);
        assertEq(widgetId, "RichTextEditor");
    }

    // --- getWidget tests ---

    function test_getWidget_returns_false_for_unknown() public {
        (bool found, string memory widgetId) = target.getWidget("unknown");
        assertFalse(found);
        assertEq(bytes(widgetId).length, 0);
    }

    function test_getWidget_multiple_types() public {
        target.registerWidget("text", "TextInput");
        target.registerWidget("number", "NumberSpinner");
        target.registerWidget("date", "DatePicker");

        (bool f1, string memory w1) = target.getWidget("text");
        (bool f2, string memory w2) = target.getWidget("number");
        (bool f3, string memory w3) = target.getWidget("date");

        assertTrue(f1);
        assertEq(w1, "TextInput");
        assertTrue(f2);
        assertEq(w2, "NumberSpinner");
        assertTrue(f3);
        assertEq(w3, "DatePicker");
    }
}
