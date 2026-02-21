// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/View.sol";

contract ViewTest is Test {
    View public target;

    event ViewCreated(bytes32 indexed viewId);
    event ViewUpdated(bytes32 indexed viewId);

    function setUp() public {
        target = new View();
    }

    // --- create tests ---

    function test_create_stores_view() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks Board", "tasks", "board");

        View.ViewData memory v = target.getView(vid);
        assertEq(v.name, "Tasks Board");
        assertEq(v.dataSource, "tasks");
        assertEq(v.layout, "board");
        assertTrue(v.exists);
    }

    function test_create_emits_event() public {
        bytes32 vid = keccak256("v1");

        vm.expectEmit(true, false, false, false);
        emit ViewCreated(vid);

        target.create(vid, "Tasks Board", "tasks", "board");
    }

    function test_create_duplicate_reverts() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks Board", "tasks", "board");

        vm.expectRevert("View already exists");
        target.create(vid, "Other", "other", "list");
    }

    function test_create_empty_name_reverts() public {
        bytes32 vid = keccak256("v1");

        vm.expectRevert("Name cannot be empty");
        target.create(vid, "", "tasks", "board");
    }

    // --- setFilter tests ---

    function test_setFilter_updates_filters() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks", "tasks", "board");
        target.setFilter(vid, "status:eq:active");

        View.ViewData memory v = target.getView(vid);
        assertEq(v.filters, "status:eq:active");
    }

    function test_setFilter_nonexistent_reverts() public {
        vm.expectRevert("View does not exist");
        target.setFilter(keccak256("none"), "rule");
    }

    // --- setSort tests ---

    function test_setSort_updates_sorts() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks", "tasks", "board");
        target.setSort(vid, "name:asc");

        View.ViewData memory v = target.getView(vid);
        assertEq(v.sorts, "name:asc");
    }

    function test_setSort_nonexistent_reverts() public {
        vm.expectRevert("View does not exist");
        target.setSort(keccak256("none"), "rule");
    }

    // --- setGroup tests ---

    function test_setGroup_updates_group_field() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks", "tasks", "board");
        target.setGroup(vid, "status");

        View.ViewData memory v = target.getView(vid);
        assertEq(v.groupField, "status");
    }

    function test_setGroup_nonexistent_reverts() public {
        vm.expectRevert("View does not exist");
        target.setGroup(keccak256("none"), "field");
    }

    // --- setVisibleFields tests ---

    function test_setVisibleFields_updates_visible() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks", "tasks", "board");
        target.setVisibleFields(vid, "title,status,date");

        View.ViewData memory v = target.getView(vid);
        assertEq(v.visibleFields, "title,status,date");
    }

    function test_setVisibleFields_nonexistent_reverts() public {
        vm.expectRevert("View does not exist");
        target.setVisibleFields(keccak256("none"), "fields");
    }

    // --- changeLayout tests ---

    function test_changeLayout_updates_layout() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks", "tasks", "board");
        target.changeLayout(vid, "table");

        View.ViewData memory v = target.getView(vid);
        assertEq(v.layout, "table");
    }

    function test_changeLayout_emits_event() public {
        bytes32 vid = keccak256("v1");
        target.create(vid, "Tasks", "tasks", "board");

        vm.expectEmit(true, false, false, false);
        emit ViewUpdated(vid);

        target.changeLayout(vid, "table");
    }

    function test_changeLayout_nonexistent_reverts() public {
        vm.expectRevert("View does not exist");
        target.changeLayout(keccak256("none"), "table");
    }

    // --- getView tests ---

    function test_getView_nonexistent_reverts() public {
        vm.expectRevert("View does not exist");
        target.getView(keccak256("none"));
    }
}
