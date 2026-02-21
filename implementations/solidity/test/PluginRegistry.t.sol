// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PluginRegistry.sol";

contract PluginRegistryTest is Test {
    PluginRegistry public target;

    event TypeRegistered(bytes32 indexed typeId);
    event PluginRegistered(bytes32 indexed typeId, bytes32 indexed pluginId);

    function setUp() public {
        target = new PluginRegistry();
    }

    // --- registerType tests ---

    function test_registerType_stores_type() public {
        bytes32 typeId = keccak256("formatter");
        target.registerType(typeId, "format-definition");

        assertTrue(target.typeExists(typeId), "Type should exist");
    }

    function test_registerType_emits_event() public {
        bytes32 typeId = keccak256("formatter");

        vm.expectEmit(true, false, false, false);
        emit TypeRegistered(typeId);

        target.registerType(typeId, "definition");
    }

    function test_registerType_zero_id_reverts() public {
        vm.expectRevert("Type ID cannot be zero");
        target.registerType(bytes32(0), "def");
    }

    function test_registerType_duplicate_reverts() public {
        bytes32 typeId = keccak256("formatter");
        target.registerType(typeId, "def");

        vm.expectRevert("Plugin type already exists");
        target.registerType(typeId, "def2");
    }

    function test_registerType_empty_definition_reverts() public {
        vm.expectRevert("Definition cannot be empty");
        target.registerType(keccak256("t1"), "");
    }

    // --- registerPlugin tests ---

    function test_registerPlugin_stores_plugin() public {
        bytes32 typeId = keccak256("formatter");
        bytes32 pluginId = keccak256("markdown");
        target.registerType(typeId, "def");
        target.registerPlugin(typeId, pluginId, "md-config");

        PluginRegistry.PluginDef memory p = target.getPlugin(typeId, pluginId);
        assertEq(p.config, "md-config", "Plugin config should match");
        assertTrue(p.exists, "Plugin should exist");
    }

    function test_registerPlugin_adds_to_list() public {
        bytes32 typeId = keccak256("formatter");
        target.registerType(typeId, "def");

        bytes32 p1 = keccak256("plugin1");
        bytes32 p2 = keccak256("plugin2");
        target.registerPlugin(typeId, p1, "config1");
        target.registerPlugin(typeId, p2, "config2");

        bytes32[] memory plugins = target.getPlugins(typeId);
        assertEq(plugins.length, 2, "Should have 2 plugins");
        assertEq(plugins[0], p1);
        assertEq(plugins[1], p2);
    }

    function test_registerPlugin_nonexistent_type_reverts() public {
        vm.expectRevert("Plugin type not found");
        target.registerPlugin(keccak256("missing"), keccak256("p1"), "config");
    }

    function test_registerPlugin_zero_plugin_id_reverts() public {
        bytes32 typeId = keccak256("formatter");
        target.registerType(typeId, "def");

        vm.expectRevert("Plugin ID cannot be zero");
        target.registerPlugin(typeId, bytes32(0), "config");
    }

    function test_registerPlugin_duplicate_reverts() public {
        bytes32 typeId = keccak256("formatter");
        bytes32 pluginId = keccak256("p1");
        target.registerType(typeId, "def");
        target.registerPlugin(typeId, pluginId, "config");

        vm.expectRevert("Plugin already exists");
        target.registerPlugin(typeId, pluginId, "config2");
    }

    // --- getPlugins tests ---

    function test_getPlugins_nonexistent_type_reverts() public {
        vm.expectRevert("Plugin type not found");
        target.getPlugins(keccak256("missing"));
    }

    // --- getPlugin tests ---

    function test_getPlugin_nonexistent_reverts() public {
        bytes32 typeId = keccak256("formatter");
        target.registerType(typeId, "def");

        vm.expectRevert("Plugin not found");
        target.getPlugin(typeId, keccak256("missing"));
    }

    // --- typeExists tests ---

    function test_typeExists_false_for_missing() public view {
        assertFalse(target.typeExists(keccak256("missing")));
    }
}
