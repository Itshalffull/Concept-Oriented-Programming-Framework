// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DisplayMode.sol";

contract DisplayModeTest is Test {
    DisplayMode public target;

    event ModeDefined(bytes32 indexed modeId, string name);
    event FieldConfigured(bytes32 indexed schemaId, bytes32 indexed modeId, bytes32 fieldId);

    function setUp() public {
        target = new DisplayMode();
    }

    // --- defineMode tests ---

    function test_defineMode_stores_mode() public {
        bytes32 mid = keccak256("m1");
        target.defineMode(mid, "Full View", "view");

        DisplayMode.Mode memory m = target.getMode(mid);
        assertEq(m.name, "Full View");
        assertEq(m.modeType, "view");
        assertTrue(m.exists);
    }

    function test_defineMode_emits_event() public {
        bytes32 mid = keccak256("m1");

        vm.expectEmit(true, false, false, true);
        emit ModeDefined(mid, "Full View");

        target.defineMode(mid, "Full View", "view");
    }

    function test_defineMode_duplicate_reverts() public {
        bytes32 mid = keccak256("m1");
        target.defineMode(mid, "Full View", "view");

        vm.expectRevert("Mode already exists");
        target.defineMode(mid, "Other", "form");
    }

    function test_defineMode_empty_name_reverts() public {
        bytes32 mid = keccak256("m1");

        vm.expectRevert("Name cannot be empty");
        target.defineMode(mid, "", "view");
    }

    // --- configureFieldDisplay tests ---

    function test_configureFieldDisplay_stores_config() public {
        bytes32 mid = keccak256("m1");
        bytes32 sid = keccak256("schema1");
        bytes32 fid = keccak256("field1");
        target.defineMode(mid, "Full View", "view");
        target.configureFieldDisplay(sid, mid, fid, "text", "truncate:100");

        DisplayMode.FieldDisplayConfig memory cfg = target.getFieldConfig(sid, mid, fid);
        assertEq(cfg.formatter, "text");
        assertEq(cfg.settings, "truncate:100");
        assertTrue(cfg.exists);
    }

    function test_configureFieldDisplay_emits_event() public {
        bytes32 mid = keccak256("m1");
        bytes32 sid = keccak256("schema1");
        bytes32 fid = keccak256("field1");
        target.defineMode(mid, "Full View", "view");

        vm.expectEmit(true, true, false, true);
        emit FieldConfigured(sid, mid, fid);

        target.configureFieldDisplay(sid, mid, fid, "text", "truncate:100");
    }

    function test_configureFieldDisplay_nonexistent_mode_reverts() public {
        bytes32 mid = keccak256("nonexistent");
        bytes32 sid = keccak256("schema1");
        bytes32 fid = keccak256("field1");

        vm.expectRevert("Mode does not exist");
        target.configureFieldDisplay(sid, mid, fid, "text", "settings");
    }

    // --- getMode tests ---

    function test_getMode_nonexistent_reverts() public {
        vm.expectRevert("Mode does not exist");
        target.getMode(keccak256("nonexistent"));
    }

    // --- getFieldConfig tests ---

    function test_getFieldConfig_returns_empty_for_unconfigured() public {
        bytes32 sid = keccak256("schema1");
        bytes32 mid = keccak256("m1");
        bytes32 fid = keccak256("field1");

        DisplayMode.FieldDisplayConfig memory cfg = target.getFieldConfig(sid, mid, fid);
        assertFalse(cfg.exists);
    }
}
