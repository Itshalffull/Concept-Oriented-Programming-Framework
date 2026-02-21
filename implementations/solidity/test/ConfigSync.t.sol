// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConfigSync.sol";

contract ConfigSyncTest is Test {
    ConfigSync public target;

    event ConfigSet(bytes32 indexed key);
    event ConfigOverridden(bytes32 indexed key, string layer);

    function setUp() public {
        target = new ConfigSync();
    }

    // --- setConfig tests ---

    function test_setConfig_stores_value() public {
        bytes32 key = keccak256("site_name");
        target.setConfig(key, "My Site");

        (bool found, string memory value) = target.getConfig(key);
        assertTrue(found, "Config should be found");
        assertEq(value, "My Site", "Value should match");
    }

    function test_setConfig_emits_event() public {
        bytes32 key = keccak256("key");

        vm.expectEmit(true, false, false, false);
        emit ConfigSet(key);

        target.setConfig(key, "val");
    }

    function test_setConfig_zero_key_reverts() public {
        vm.expectRevert("Config key cannot be zero");
        target.setConfig(bytes32(0), "val");
    }

    function test_setConfig_increments_count() public {
        target.setConfig(keccak256("k1"), "v1");
        target.setConfig(keccak256("k2"), "v2");
        assertEq(target.configCount(), 2, "Count should be 2");
    }

    function test_setConfig_overwrite_does_not_duplicate_count() public {
        bytes32 key = keccak256("k1");
        target.setConfig(key, "v1");
        target.setConfig(key, "v2");

        assertEq(target.configCount(), 1, "Count should remain 1 on overwrite");

        (bool found, string memory value) = target.getConfig(key);
        assertTrue(found);
        assertEq(value, "v2", "Value should be overwritten");
    }

    // --- overrideConfig tests ---

    function test_overrideConfig_stores_layer_value() public {
        bytes32 key = keccak256("db_host");
        target.setConfig(key, "localhost");
        target.overrideConfig(key, "production-db", "production");

        (bool found, string memory value) = target.getOverride(key, "production");
        assertTrue(found, "Override should be found");
        assertEq(value, "production-db", "Override value should match");
    }

    function test_overrideConfig_nonexistent_key_reverts() public {
        vm.expectRevert("Config key not found");
        target.overrideConfig(keccak256("missing"), "val", "layer");
    }

    function test_overrideConfig_empty_layer_reverts() public {
        bytes32 key = keccak256("k1");
        target.setConfig(key, "val");

        vm.expectRevert("Layer cannot be empty");
        target.overrideConfig(key, "val2", "");
    }

    // --- getConfig tests ---

    function test_getConfig_missing_returns_false() public view {
        (bool found,) = target.getConfig(keccak256("missing"));
        assertFalse(found, "Missing config should return false");
    }

    // --- getOverride tests ---

    function test_getOverride_missing_key_returns_false() public view {
        (bool found,) = target.getOverride(keccak256("missing"), "layer");
        assertFalse(found, "Missing key override should return false");
    }

    function test_getOverride_missing_layer_returns_false() public {
        bytes32 key = keccak256("k1");
        target.setConfig(key, "base");

        (bool found,) = target.getOverride(key, "nonexistent");
        assertFalse(found, "Missing layer override should return false");
    }
}
