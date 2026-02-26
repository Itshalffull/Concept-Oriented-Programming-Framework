// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AccessControl.sol";

contract AccessControlTest is Test {
    AccessControl public target;

    function setUp() public {
        target = new AccessControl();
    }

    // --- orIf tests ---

    function test_orIf_allowed_allowed_returns_allowed() public {
        uint8 result = target.orIf(0, 0); // Allowed, Allowed
        assertEq(result, 0); // Allowed
    }

    function test_orIf_allowed_neutral_returns_allowed() public {
        uint8 result = target.orIf(0, 1); // Allowed, Neutral
        assertEq(result, 0); // Allowed
    }

    function test_orIf_neutral_neutral_returns_neutral() public {
        uint8 result = target.orIf(1, 1); // Neutral, Neutral
        assertEq(result, 1); // Neutral
    }

    function test_orIf_forbidden_allowed_returns_forbidden() public {
        uint8 result = target.orIf(2, 0); // Forbidden, Allowed
        assertEq(result, 2); // Forbidden
    }

    function test_orIf_allowed_forbidden_returns_forbidden() public {
        uint8 result = target.orIf(0, 2); // Allowed, Forbidden
        assertEq(result, 2); // Forbidden
    }

    function test_orIf_invalid_a_reverts() public {
        vm.expectRevert("Invalid access result a");
        target.orIf(3, 0);
    }

    function test_orIf_invalid_b_reverts() public {
        vm.expectRevert("Invalid access result b");
        target.orIf(0, 3);
    }

    // --- andIf tests ---

    function test_andIf_allowed_allowed_returns_allowed() public {
        uint8 result = target.andIf(0, 0); // Allowed, Allowed
        assertEq(result, 0); // Allowed
    }

    function test_andIf_allowed_neutral_returns_neutral() public {
        uint8 result = target.andIf(0, 1); // Allowed, Neutral
        assertEq(result, 1); // Neutral
    }

    function test_andIf_neutral_neutral_returns_neutral() public {
        uint8 result = target.andIf(1, 1); // Neutral, Neutral
        assertEq(result, 1); // Neutral
    }

    function test_andIf_forbidden_allowed_returns_forbidden() public {
        uint8 result = target.andIf(2, 0); // Forbidden, Allowed
        assertEq(result, 2); // Forbidden
    }

    function test_andIf_allowed_forbidden_returns_forbidden() public {
        uint8 result = target.andIf(0, 2); // Allowed, Forbidden
        assertEq(result, 2); // Forbidden
    }

    function test_andIf_invalid_a_reverts() public {
        vm.expectRevert("Invalid access result a");
        target.andIf(3, 0);
    }

    function test_andIf_invalid_b_reverts() public {
        vm.expectRevert("Invalid access result b");
        target.andIf(0, 3);
    }
}
