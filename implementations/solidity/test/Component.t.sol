// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Component.sol";

contract ComponentTest is Test {
    Component public target;

    event ComponentRegistered(bytes32 indexed componentId);
    event Placed(bytes32 indexed placementId, bytes32 indexed componentId, string region);
    event VisibilitySet(bytes32 indexed placementId);

    function setUp() public {
        target = new Component();
    }

    // --- register tests ---

    function test_register_stores_component() public {
        bytes32 id = keccak256("comp1");
        target.register(id, "button-config");

        Component.ComponentData memory data = target.getComponent(id);
        assertEq(data.config, "button-config", "Config should match");
        assertTrue(data.exists, "Component should exist");
    }

    function test_register_emits_event() public {
        bytes32 id = keccak256("comp1");

        vm.expectEmit(true, false, false, false);
        emit ComponentRegistered(id);

        target.register(id, "config");
    }

    function test_register_zero_id_reverts() public {
        vm.expectRevert("Component ID cannot be zero");
        target.register(bytes32(0), "config");
    }

    function test_register_duplicate_reverts() public {
        bytes32 id = keccak256("comp1");
        target.register(id, "config");

        vm.expectRevert("Component already exists");
        target.register(id, "config2");
    }

    // --- place tests ---

    function test_place_stores_placement() public {
        bytes32 compId = keccak256("comp1");
        bytes32 placeId = keccak256("place1");
        target.register(compId, "config");
        target.place(placeId, compId, "sidebar", 10);

        Component.Placement memory p = target.getPlacement(placeId);
        assertEq(p.componentId, compId, "Component ID should match");
        assertEq(p.region, "sidebar", "Region should match");
        assertEq(p.weight, 10, "Weight should match");
        assertTrue(p.exists, "Placement should exist");
    }

    function test_place_zero_placement_id_reverts() public {
        bytes32 compId = keccak256("comp1");
        target.register(compId, "config");

        vm.expectRevert("Placement ID cannot be zero");
        target.place(bytes32(0), compId, "sidebar", 0);
    }

    function test_place_nonexistent_component_reverts() public {
        vm.expectRevert("Component not found");
        target.place(keccak256("p1"), keccak256("missing"), "sidebar", 0);
    }

    function test_place_empty_region_reverts() public {
        bytes32 compId = keccak256("comp1");
        target.register(compId, "config");

        vm.expectRevert("Region cannot be empty");
        target.place(keccak256("p1"), compId, "", 0);
    }

    // --- setVisibility tests ---

    function test_setVisibility_updates_conditions() public {
        bytes32 compId = keccak256("comp1");
        bytes32 placeId = keccak256("place1");
        target.register(compId, "config");
        target.place(placeId, compId, "header", 0);

        target.setVisibility(placeId, "role:admin");

        Component.Placement memory p = target.getPlacement(placeId);
        assertEq(p.conditions, "role:admin", "Conditions should be updated");
    }

    function test_setVisibility_nonexistent_placement_reverts() public {
        vm.expectRevert("Placement not found");
        target.setVisibility(keccak256("missing"), "cond");
    }

    // --- getComponent tests ---

    function test_getComponent_nonexistent_reverts() public {
        vm.expectRevert("Component not found");
        target.getComponent(keccak256("missing"));
    }

    // --- getPlacement tests ---

    function test_getPlacement_nonexistent_reverts() public {
        vm.expectRevert("Placement not found");
        target.getPlacement(keccak256("missing"));
    }
}
