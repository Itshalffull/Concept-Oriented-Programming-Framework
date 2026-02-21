// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ExposedFilter.sol";

contract ExposedFilterTest is Test {
    ExposedFilter public target;

    event FilterExposed(bytes32 indexed filterId);
    event InputCollected(bytes32 indexed filterId);
    event FiltersReset();

    function setUp() public {
        target = new ExposedFilter();
    }

    // --- expose tests ---

    function test_expose_stores_filter() public {
        bytes32 fid = keccak256("f1");
        target.expose(fid, "select:status", "all");

        ExposedFilter.FilterConfig memory f = target.getFilter(fid);
        assertEq(f.config, "select:status");
        assertEq(f.defaultValue, "all");
        assertEq(f.currentValue, "all");
        assertTrue(f.exists);
    }

    function test_expose_emits_event() public {
        bytes32 fid = keccak256("f1");

        vm.expectEmit(true, false, false, false);
        emit FilterExposed(fid);

        target.expose(fid, "select:status", "all");
    }

    function test_expose_duplicate_reverts() public {
        bytes32 fid = keccak256("f1");
        target.expose(fid, "select:status", "all");

        vm.expectRevert("Filter already exists");
        target.expose(fid, "select:status", "all");
    }

    // --- collectInput tests ---

    function test_collectInput_updates_current_value() public {
        bytes32 fid = keccak256("f1");
        target.expose(fid, "select:status", "all");
        target.collectInput(fid, "active");

        ExposedFilter.FilterConfig memory f = target.getFilter(fid);
        assertEq(f.currentValue, "active");
    }

    function test_collectInput_emits_event() public {
        bytes32 fid = keccak256("f1");
        target.expose(fid, "select:status", "all");

        vm.expectEmit(true, false, false, false);
        emit InputCollected(fid);

        target.collectInput(fid, "active");
    }

    function test_collectInput_nonexistent_reverts() public {
        bytes32 fid = keccak256("nonexistent");

        vm.expectRevert("Filter does not exist");
        target.collectInput(fid, "active");
    }

    // --- getFilter tests ---

    function test_getFilter_nonexistent_reverts() public {
        bytes32 fid = keccak256("nonexistent");

        vm.expectRevert("Filter does not exist");
        target.getFilter(fid);
    }

    // --- resetToDefaults tests ---

    function test_resetToDefaults_restores_default_value() public {
        bytes32 fid = keccak256("f1");
        target.expose(fid, "select:status", "all");
        target.collectInput(fid, "active");
        target.resetToDefaults(fid);

        ExposedFilter.FilterConfig memory f = target.getFilter(fid);
        assertEq(f.currentValue, "all");
    }

    function test_resetToDefaults_emits_event() public {
        bytes32 fid = keccak256("f1");
        target.expose(fid, "select:status", "all");
        target.collectInput(fid, "active");

        vm.expectEmit(false, false, false, false);
        emit FiltersReset();

        target.resetToDefaults(fid);
    }

    function test_resetToDefaults_nonexistent_reverts() public {
        bytes32 fid = keccak256("nonexistent");

        vm.expectRevert("Filter does not exist");
        target.resetToDefaults(fid);
    }
}
